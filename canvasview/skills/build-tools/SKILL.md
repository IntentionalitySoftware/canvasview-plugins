---
name: build-tools
description: Give a CanvasView canvas tools, server-side code the canvas runs for its components. Use when a component needs a backend that looks something up in an approved data source, keeps its own data between calls, or polls or streams into shared state. Covers the three files of a tool, test_tool, publish_tools, calling a tool from a component and reading failures.
---

# Build tools

A tool is code the canvas runs on the server. A component calls it by name; the sandbox still has
no network. Write components as the build-component skill describes.

| You need | Use |
| --- | --- |
| Input you computed before creating the canvas | `data` |
| One viewer reads or writes an approved service as it is | `useData` with a data source (build-app) |
| A value people change and everyone sees | `useSharedState` |
| Server code: reshape or combine a source's answers, keep data between calls, one upstream call for everyone, a feed into shared state, or something your agent runs too (`call_tool`) | A tool |

## The three files

A tool has a name (a lowercase letter, then up to 39 letters, digits or underscores) and three files:
- **`tool.js`**: one module, up to 256 KB, no npm imports. It must `export class Tool extends DurableObject`
  (imported from `cloudflare:workers`) with `async fetch(request)`. `await request.json()` gives
  `{ input, trigger }`; `trigger` is `"call"`, `"poll"` or `"stream"`. Answer with
  `return Response.json(output)`. A thrown error or a status outside 200 to 299 fails the call.
- **`tool.json`**, the manifest, up to 32 KB; unknown fields are refused. Required: `purpose` (1 to
  500 characters), `kind`, `input`, `output`. Optional: `sources` (up to 5 data source names),
  `writes` (up to 20 shared-state keys, or prefixes ending `.*` or `:*`), `intervalSeconds` (5 to
  86400; required for a poll, refused otherwise), `readOnly` (default false), `timeoutMs` (100 to 10000).
- **`cases.json`**: an array of 1 to 20 cases, up to 256 KB. A case is `{ name, input, sources, expect }`.
  `sources` holds up to 20 recorded answers `{ source, method, path, status, body }` (`method` defaults
  to GET, `status` to 200; `path` starts with `/` and carries the query exactly as the tool writes it).
  `expect` is optional: `{ output, state }`, the exact output and the exact shared-state values written.

`input` and `output` are `{ "type": "object", "properties": {...}, "required": [...] }`. A property is
a string, number, integer or boolean, an array of those, or a flat object or array of flat objects.
A field not in `properties` is refused, in input and in output. Input: 64 KB at most. Output: 256 KB.

## Call, poll, stream

- `call`: runs when a component or an agent calls it. The output goes only to the caller.
- `poll`: the canvas calls it every `intervalSeconds` with input `{}`. Nobody receives its output.
- `stream`: the canvas starts it once. Open a WebSocket to a source with
  `fetch(url, { headers: { Upgrade: "websocket" } })`, call `response.webSocket.accept()`, write each
  message to shared state and return at once. Its case records `status: 101` and `messages` (up to 50).

A poll or a stream requires no input and reaches people only through shared state. Both stop when
the last page leaves or all have been silent for five minutes, and start again when someone returns.

## What a tool can use

- **Data sources**: `fetch("https://<source>.source/<path>?<query>")`. The source must be in the
  manifest's `sources`, approved by the organization (`list_data_sources`, `request_data_source`) and
  declared in the canvas's `dataSources`. CanvasView attaches the secrets; the tool never sees them.
  Only your Accept and Content-Type headers are kept. Only methods the Admin allowed pass. Redirects
  are refused. Any other host answers 403. At most 20 requests a call, 256 KB a request body.
- **Its own data**: `this.ctx.storage.kv` (`get(key)`, `put(key, value)`) and
  `this.ctx.storage.sql.exec(...)`, a private SQLite database. It survives new versions of the tool
  and is erased when the tool is removed or the canvas is deleted. A tool runs one call at a time, so
  reading then writing is safe. Every case starts with an empty database. A tool cannot set alarms.
- **Shared state**: `await this.env.CANVAS.setState(key, value)`, for a key the manifest lists in
  `writes`. Without a contract the key must start `tools.<name>.`; with one, the contract must
  declare it. JSON up to 64 KB, 20 writes a second. It throws when refused.
- **Limits**: 20 tools a canvas; 10 seconds a call (or `timeoutMs`); 5 seconds of CPU; 8 calls in flight
  per canvas. People who only view a canvas, and anyone on a closed canvas, cannot set a tool off.

## Work in this order

1. Write the three files. For a tool that only reads, set `readOnly: true`.
2. `test_tool` with `{ id, name, tool: { code, manifest, cases } }` runs the gate, makes nothing live
   and returns `{ passed, issues, cases }`. No source is contacted: an unrecorded request fails the case.
3. To record a case instead of writing one, call `test_tool` with `tool: { code, manifest }`,
   `live: true` and `input`. A `readOnly` tool then runs once against the real source, GET only, and
   the result's `case` is ready to save in `cases.json`. Streams cannot be recorded this way.
4. `publish_tools` with `{ id, tools: { <name>: { code, manifest, cases } } }` gates every tool the
   canvas would hold, then makes them live. A refusal is `tools_invalid` and changes nothing.
   `remove: [name]` deletes a tool with its data. Check with `list_tools`, try with `call_tool`.
   Each publish is a commit; to use Git instead: `get_repository_token`, push, `pull_repository`.
5. Call it from a component: `await canvas.tools.<name>(input)` rejects with `error.reason`;
   `useTool` never rejects. Render `ToolUnavailable` when `available` is false or a call failed.

## A complete example

A stock price everyone on the canvas sees, with the price seen before it. The canvas declares
`"dataSources": ["quotes"]`. `tools/quote/tool.js`:
```js
import { DurableObject } from "cloudflare:workers";
export class Tool extends DurableObject {
  async fetch(request) {
    const { input } = await request.json();
    const response = await fetch("https://quotes.source/quote?symbol=" + encodeURIComponent(input.symbol));
    if (!response.ok) return new Response("quotes answered " + response.status, { status: 502 });
    const { symbol, price } = await response.json();
    const previous = this.ctx.storage.kv.get("price:" + symbol);
    this.ctx.storage.kv.put("price:" + symbol, price);
    const quote = previous === undefined ? { symbol, price } : { symbol, price, previous };
    await this.env.CANVAS.setState("tools.quote.latest", quote);
    return Response.json(quote);
  }
}
```

`tools/quote/tool.json`:
```json
{ "purpose": "The latest price of a stock, and the price this canvas saw before it.", "kind": "call",
  "input": { "type": "object", "properties": { "symbol": { "type": "string" } }, "required": ["symbol"] },
  "output": { "type": "object", "required": ["symbol", "price"], "properties": { "symbol": { "type": "string" }, "price": { "type": "number" }, "previous": { "type": "number" } } },
  "sources": ["quotes"], "writes": ["tools.quote.latest"], "readOnly": true }
```

`tools/quote/cases.json`:
```json
[{ "name": "first quote", "input": { "symbol": "ACME" }, "sources": [{ "source": "quotes", "method": "GET", "path": "/quote?symbol=ACME", "status": 200, "body": { "symbol": "ACME", "price": 101.5 } }],
   "expect": { "output": { "symbol": "ACME", "price": 101.5 }, "state": { "tools.quote.latest": { "symbol": "ACME", "price": 101.5 } } } }]
```

`components/quote.tsx`:
```tsx
import { ToolUnavailable, useSharedState, useTool } from "@canvasview/kit";
type Quote = { symbol: string; price: number; previous?: number };
export default function QuoteCard({ data }: { data: { symbol: string } }) {
  const { call, pending, error, available } = useTool<Quote>("quote");
  const [latest] = useSharedState<Quote | null>("tools.quote.latest", null);
  if (!available) return <ToolUnavailable what="Price" />;
  return (
    <div className="grid gap-3 p-4">
      <button type="button" disabled={pending} onClick={() => void call({ symbol: data.symbol })} className="rounded-lg border border-border px-3 py-2">Look up {data.symbol}</button>
      {error ? <ToolUnavailable what="Price" error={error} /> : null}
      {latest ? <p>{latest.symbol}: {latest.price}{latest.previous === undefined ? "" : ` (was ${latest.previous})`}</p> : null}
    </div>
  );
}
```

## When a tool fails

- **The gate** returns issues `{ path, code, message }`; `path` is `["tools", "<name>", "<file>", ...]`.
  Common codes: `"manifest_invalid"`, `"tool_class_missing"`, `"source_not_approved"`,
  `"tool_load_failed"`, `"case_unrecorded_request"`, `"case_output_invalid"`, `"case_expectation_failed"`.
- **A call** fails with `tool_unavailable`, `"tool_failed"`, `tool_timeout`, `invalid_tool_input`, or
  in a component also `read_only`, `offline` or `rate_limit`; `call_tool` adds `tool_not_found` and `tool_busy`.
- **Health**: a tool that fails its first 3 calls after going live, or more than half of its last
  20, is marked failing: the canvas goes back to the last commit whose tools worked, or the tool
  answers `tool_unavailable`. `get_tool_log` shows each call's outcome and each tool's `reason`.

## Common mistakes

- Fetching a URL. Use `https://<source>.source/...` for a source named in the manifest.
- Naming a source the canvas does not declare in `dataSources`: the gate says `"source_not_approved"`.
- A case whose recorded `path` differs from the tool's request, even by one query parameter.
