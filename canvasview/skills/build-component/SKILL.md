---
name: build-component
description: Write a custom CanvasView component in TSX when no built-in building block fits, then save it to the account's component library. Covers the source rules, data, shared state, drafting answers, sandbox limits and sizing.
---

# Build a component

A component node runs your TSX in a sandboxed frame on the canvas. Write one only after
`search_components` found nothing to reuse and no building block fits (see the create-canvas skill).
For components that work together, call outside services or import npm packages, see the build-app skill.

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

- **No network.** `fetch`, images from URLs and iframes are blocked. Put what the component
  needs into `data`, or read an owner-approved data source with `useData` (see build-app).
- **Links do not open** (put them in a `Note` node). **No access** to cookies or the parent window.
- **Long loops are stopped.** A loop that keeps the frame busy for more than about 750 ms
  throws, and a frame that stops responding for 5 seconds is replaced. Keep work small and
  precompute heavy results before you create the canvas.

## What not to build

- **No sign-in screens and no fields asking for a password, API key, card number or other
  secret, and no imitations of CanvasView's controls or another product's sign-in.** CanvasView
  never asks people to sign in on a canvas, so a login box there looks like phishing.

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

## Use the kit and Tailwind

Compose kit blocks inside your component instead of rebuilding them: `Note`, `DataTable`,
`Chart`, `Decision` and the others take the same props as their widget data
(see [kit.md](../../reference/kit.md)). Style the rest with Tailwind classes, compiled when the
canvas is saved on the kit's theme: `bg-surface`, `text-muted`, `border-border`, `bg-accent` and
`text-accent-foreground` follow the viewer's theme, as does `dark:`. The frame starts from
Tailwind's reset, so give content room (`p-4`, `gap-3`, `rounded-xl`) and style headings and
buttons. Write class names in full: only names in the source are compiled. `style` works too.
First call `get_skill` with name `design-system`: if the organization chose a design, follow it.

```tsx
import { useState } from "react";
import { Note, useDraft, useSharedState } from "@canvasview/kit";

export default function Shortlist({ data }: { data: { prompt: string } }) {
  const [names, setNames, { error }] = useSharedState<string[]>("shortlist", []);
  const [text, setText] = useState("");
  const draft = useDraft();
  const button = "rounded-lg border border-border px-3 py-2 font-medium hover:bg-default";
  return (
    <div className="grid gap-3 p-4">
      <Note markdown={data.prompt} />
      <input aria-label="Name" value={text} onChange={(event) => setText(event.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2" />
      <button type="button" className={button} onClick={() => { setNames((current) => [...current, text.trim()]); setText(""); }}>Add</button>
      {error ? <p role="alert" className="text-danger">Not saved: {error}</p> : null}
      <ul className="grid gap-1">{names.map((name) => <li key={name} className="rounded-lg bg-default px-3 py-2">{name}</li>)}</ul>
      <button type="button" className={button} onClick={() => draft?.({ shortlist: names })}>Use this list</button>
    </div>
  );
}
```

See [custom-component-shared-state.json](../../examples/custom-component-shared-state.json) for a complete canvas.

## Pages inside a component

A component can have several pages, such as a dashboard with Revenue and Customers. Declare
`routes: [{ "path": "/", "title": "Revenue" }, { "path": "/customers", "title": "Customers" }]`
on the node, then render the open one:

```tsx
const { path } = useRoute(); // from "@canvasview/kit", with RouteLink
return <>
  <nav><RouteLink to="/">Revenue</RouteLink> <RouteLink to="/customers">Customers</RouteLink></nav>
  {path === "/customers" ? <Customers rows={data.customers} /> : <Revenue rows={data.revenue} />}
</>;
```

A path is `/` or lowercase words with hyphens, with no parameters. The open page is each
viewer's own. A person can open one page full window at `/c/<canvas>/<node>/<path>`.

## Sizing

A node is 320 wide unless it declares `size: { width }` (160 to 1600), and as tall as its
content, up to 1200. Draw everything at its natural height; do not make the component scroll.
Read `size.width` rather than assuming a width: people switch to the components view.

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

- Fetching data from a URL. Pass it in `data`, or use `useData` with a declared data source.
- Keeping important state in `useState`, then losing it when the frame reloads.
- Drafting fields that are not in `answerSchema`.
- One big component for the whole canvas. Use building blocks around a small component.
