---
name: build-tools
description: Give a CanvasView canvas tools, server-side code the canvas runs for its components. Use when a component needs a backend that looks something up in an approved data source, keeps its own data between calls, or polls or streams into shared state. Covers function uploads, declared npm packages and connections, generated wrappers, final executable checks, calling tools, and lower-level runtime tools.
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

## Upload a function

Use `create_tool` for a new tool. CanvasView generates the runtime wrapper and manifest.

```json
{
  "id": "<canvas id>",
  "name": "date_label",
  "description": "Format a date for display.",
  "source": "import { format } from \"date-fns\"; export default async function(input) { return { text: format(new Date(input.date), \"MMMM d, yyyy\") }; }",
  "packages": { "date-fns": "4.1.0" },
  "inputSchema": {
    "type": "object",
    "properties": { "date": { "type": "string" } },
    "required": ["date"]
  },
  "outputSchema": {
    "type": "object",
    "properties": { "text": { "type": "string" } },
    "required": ["text"]
  },
  "cases": [{
    "name": "a date",
    "input": { "date": "2026-11-19T12:00:00Z" },
    "expect": { "output": { "text": "November 19, 2026" } }
  }]
}
```

1. Export a default JavaScript function with `(input, context)` arguments.
2. Declare each imported package with an exact version in `packages`.
3. Supply input and output schemas.
4. Supply at least one case.
5. Send `dryRun: true` to check the executable before publication.
6. Send the same input without `dryRun` to publish it.

The tool becomes callable through `canvas.tools.date_label(input)` and `call_tool`.
A name that exists replaces that tool only after every tool passes the gate.

### Connections, state and storage

`connections` maps a local alias to an approved source: `{ "market": "quotes" }`.
Declare the source in the canvas's `dataSources` before uploading the function.
A declaration does not approve a source or grant more access.

```js
export default async function(input, context) {
  const response = await context.connections.market.fetch(
    "/quote?symbol=" + encodeURIComponent(input.symbol)
  );
  if (!response.ok) throw new Error("The source could not return a quote.");
  const quote = await response.json();
  await context.state.set("latest", quote);
  return quote;
}
```

- Declare `writes: ["latest"]` for this example. CanvasView writes `tools.<name>.latest`.
- Read that full key with `useSharedState` in a core component.
- Use `context.storage.get(key)`, `put(key, value)`, and `delete(key)` for tool-local persistent data.
- Use `context.trigger` to distinguish `call`, `poll`, and `stream` executions.
- Use connection aliases in case recordings. Use full state keys in expected state.
- Set `kind: "poll"` with `intervalSeconds` for polling.
- Set `kind: "stream"` for a WebSocket feed.
- Open the socket with `context.connections.market.fetch(path, { headers: { Upgrade: "websocket" } })`.
- Accept `response.webSocket`, attach message handlers, and return the initial output promptly.

### Preparation and checks

CanvasView checks static imports, package versions, literal connection accesses, and literal state writes.
Computed accesses are checked during case execution and by runtime capability checks.
Only approved, declared sources can receive requests.
Secrets stay outside the function and its packages.

Preparation bundles packages and generates the executable without evaluating submitted code.
The gate loads and tests the final executable in isolation.
A failure preserves the current live tool.
The repository keeps source, declarations, and package artifact hashes in `tools/<name>/function.json`.
It describes the last `create_tool` upload. A push that edits `tool.js` leaves it unchanged.
The stored `tool.js` is the executable tested by the gate.
Calls and repository pulls use that executable without rebuilding packages.
Use `create_tool` again to rebuild changed function source or declarations.

Function source is limited to 256 KB. The final executable, including packages, must fit the tool's 256 KB limit.
Packages must meet the component package policy: exact versions, release age, denylist, and registry checks.
Dynamic imports, `require()`, local imports, Node built-ins, and runtime package downloads are unsupported.
Use smaller package entry points when a bundle exceeds the limit.

## Lower-level tools

Use `publish_tools` when you need to supply the runtime class directly.
Read the [runtime format](https://app.canvasview.dev/agents/tool-runtime.md) for its files, capabilities, examples, and failure behavior.
