---
name: build-component
description: Write a custom CanvasView component in TSX when no built-in building block fits, then save it to the account's component library. Covers the source rules, data, shared state, drafting answers, sandbox limits and sizing.
---

# Build a component

A component node runs your TSX in a sandboxed frame on the canvas. Write one only after
`search_components` found nothing to reuse and no building block fits (see the create-canvas skill).

## The rules the server checks

- One file of TSX with a **default export**: a React component that receives
  `{ data, theme, size }`. `data` is the node's `data` object. `theme` is `"light"` or `"dark"`
  and follows the viewer. `size.width` is the width the node has.
- **Static imports from `react`, `@canvasview/kit` and the npm packages the node declares**
  (see below). No dynamic `import()`, no `require`. Do not name anything `require` or `exports`.
- At most 64 KB of source. The whole canvas, data included, must stay under 1 MB.

A violation fails the create with `component_compile_failed` and a message such as
`ideas, line 3: Import only react or @canvasview/kit, not "lodash".` followed by the kit's exports.
Nothing is charged; fix the line and retry with the same idempotency key. `validate_canvas` reports
every failing component at once, for free.

## What the sandbox does not allow

- **No network.** `fetch`, images from URLs and iframes are blocked. Put everything the
  component needs into `data`, or read it from an owner-approved data source with `useData`
  (see below).
- **Links do not open** inside a component. Put links in a `Note` widget node instead.
- **No access** to the page's cookies or the parent window.
- **Long loops are stopped.** A loop that keeps the frame busy for more than about 750 ms
  throws, and a frame that stops responding for 5 seconds is replaced. Keep work small and
  precompute heavy results before you create the canvas.

## Data, state and answers

| You need | Use |
| --- | --- |
| Input you computed | `data` (read-only in the component) |
| Something everyone on the canvas sees and changes | `useSharedState(key, initial)` |
| Something only this viewer is typing | React `useState` |
| Fill the answer panel | `useDraft()` |
| Ask the person to confirm and send an answer now | `useSubmit()` |

- `useSharedState` returns `[value, setValue, { error }]`. Values are JSON, synced live to
  everyone and kept across reloads. Use an updater (`setValue((current) => ...)`) when the new
  value depends on the old one. Last write wins per key. If a write is rejected, it reverts
  and `error` holds the reason (for example `value_too_large` or `rate_limit`).
- Keep anything the component must remember in shared state, not React state: a frame can
  reload, for example when a tab in the components view is hidden and shown again.
- Choose clear, namespaced keys (`ideas`, `budget-inputs`). Components using the same key share
  the value, and you read the same keys with `get_canvas_state`.
- `useDraft()` and `useSubmit()` may return nothing outside a canvas; call them as `draft?.(...)`.
  The drafted object's fields must be declared in the canvas `answerSchema`.
- Prefer `draft` to `submit`. Drafting lets the person review the answer panel and send it.

## One person in control

While someone is using a component, the others see it as in use by that person and cannot
change it until they stop (about 20 seconds idle, or when they leave). This applies per
component node. Agent writes with `set_canvas_state` always apply. So:

- A component that many people edit at the same moment will feel blocked. Split it into
  several nodes, or use building blocks with `stateKey`, which have no such lock.
- Keep one component to one job.

## Use the kit

Compose kit blocks inside your component instead of rebuilding them: `Note`, `DataTable`,
`Chart`, `Decision` and the others take the same props as their widget data
(see [kit.md](../../reference/kit.md)). Plain HTML elements are fine for anything else.

```tsx
import { useState } from "react";
import { Note, useDraft, useSharedState } from "@canvasview/kit";

export default function Shortlist({ data }: { data: { prompt: string } }) {
  const [names, setNames, { error }] = useSharedState<string[]>("shortlist", []);
  const [text, setText] = useState("");
  const draft = useDraft();
  return (
    <div style={{ display: "grid", gap: 8, padding: 12 }}>
      <Note markdown={data.prompt} />
      <input aria-label="Name" value={text} onChange={(event) => setText(event.target.value)} />
      <button type="button" onClick={() => { setNames((current) => [...current, text.trim()]); setText(""); }}>Add</button>
      {error ? <p role="alert">Not saved: {error}</p> : null}
      <ul>{names.map((name) => <li key={name}>{name}</li>)}</ul>
      <button type="button" onClick={() => draft?.({ shortlist: names })}>Use this list</button>
    </div>
  );
}
```

A complete canvas with a component is in
[custom-component-shared-state.json](../../examples/custom-component-shared-state.json).

## Sizing

The default node is 320 by 240. Give the node `size: { width, height }` (width 160 to 1600,
height 80 to 1200) when it needs more room. Content taller than the node scrolls. People can
resize their screen and switch to the components view, so read `size.width` rather than
assuming a width.

## Apps, live data, npm packages

For several components that work together through shared state, components that call an outside
service through a data source, and components that import npm packages, see the build-app skill.

## Save it to the library

If the component could serve another canvas, save it with `save_component`:

- `name`: 2 to 64 lowercase letters, digits and hyphens, saying what it is (`idea-board`,
  `budget-split`), not where it was first used.
- `description`: one or two sentences on what it shows, what `data` it expects and which
  shared-state keys and answer fields it uses. Search matches on name and description.
- `exampleData`: a small realistic `data` object (16 KB at most).

Saving checks the source exactly as `create_canvas` does, and saving an existing name replaces
it. Canvases already using a component keep their own copy. Place it later with
`{ "kind": "component", "ref": "idea-board", "data": {...} }`.

## Common mistakes

- Fetching data from a URL. Pass it in `data`, or use `useData` with a data source the canvas
  declares in `dataSources`.
- Keeping important state in `useState`, then losing it when the frame reloads.
- Drafting fields that are not in `answerSchema`.
- One big component for the whole canvas. Use building blocks around a small component.
