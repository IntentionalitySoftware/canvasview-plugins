---
name: arrange-canvas
description: Lay out, line up, space, move or resize nodes on a CanvasView canvas, and choose between the canvas view and the components view. Use when someone asks to tidy a canvas, put one thing next to another, or show parts side by side.
---

# Arrange a canvas

Layout lives beside the canvas spec. Moving or sizing nodes with `arrange_canvas` is free, does
not change the canvas version, and moves the nodes live in every open browser. Use it instead of
`update_canvas` whenever only the arrangement changes.

## Automatic layout

You rarely need to place nodes yourself:

- With `edges`, nodes are laid out top to bottom along the edges (`flow`). Use edges to show
  how evidence leads to the decision.
- Without edges, nodes go in a `grid`.
- A node is 320 wide unless it declares `size: { width, height }` (width 160 to 1600). Give wide
  content such as tables and charts more width. Height takes care of itself: a node grows to show
  all its content, up to 1200, and the canvas makes room below it.

People can drag and resize nodes and tidy the canvas themselves. Resending a canvas with `update_canvas`
does not undo their moves: a position in the spec only wins when it is new or changed.

## `arrange_canvas` operations

Pass the canvas `id` and any of these. They apply in this order: `sizes`, `layout`, `positions`,
`align`, `distribute`. `nodes` limits `layout`, `align` and `distribute` to those node IDs, and
`spacing` sets the gap (default 40).

- `layout`: `flow`, `grid`, `row` or `column`.
- `positions`: `{ "<node id>": { "x": 0, "y": 0 } }`, the top-left corner of each node.
- `sizes`: `{ "<node id>": { "width": 640, "height": 360 } }`. Fixes the size: taller content
  scrolls inside it. Use it only when someone asks for a node of a set size; people can also drag a node's corner.
- `align`: `left`, `right`, `top`, `bottom`, `center-horizontal` (one shared centre x) or
  `center-vertical` (one shared centre y).
- `distribute`: `horizontal` or `vertical`, with gaps of `spacing` or shared evenly.

The result is the final layout of every node (`x`, `y`, `width`, `height`), plus `panes` and `view`.

### "Line these up"

Put the chosen nodes in one row with equal gaps:

```json
{ "id": "<canvas id>", "nodes": ["costs", "compare", "choice"], "layout": "row", "spacing": 40 }
```

To keep their current horizontal order and only level them, align and distribute instead:

```json
{ "id": "<canvas id>", "nodes": ["costs", "compare", "choice"], "align": "top", "distribute": "horizontal" }
```

### "Put the chart next to the table"

1. Call `get_canvas` and read `layout` for both nodes, for example
   `"spend": { "x": 0, "y": 280, "width": 640, "height": 320 }`.
2. Place the chart to the right, at the same top, one gap away:

```json
{ "id": "<canvas id>", "positions": { "trend": { "x": 680, "y": 280 } } }
```

`x` is the table's `x` + `width` + 40. For "below", use the table's `y` + `height` + 40 and its `x`.

### "Tidy it up"

`{ "id": "<canvas id>", "layout": "flow" }` (with edges) or `"grid"`. Layouts never overlap nodes.
Align and distribute keep the chosen nodes apart but may overlap nodes you did not choose, so
check the returned layout.

## Canvas view and components view

Every canvas has two views:

- **Canvas view**: nodes on a board, with edges. Best for an overview, many small nodes, and
  showing how evidence leads to the decision.
- **Components view**: the screen split into 1, 2 or 4 areas (two side by side, four in a two
  by two grid), each showing nodes as tabs at full size. Best when people work closely with a
  few large nodes: a contract beside its approval, a table beside its chart, a component that
  needs room.

Set the shared arrangement and the view links open in:

```json
{
  "id": "<canvas id>",
  "panes": { "areas": 2, "tabs": [["addendum"], ["sign-off"]] },
  "view": "components"
}
```

- Give one list of node IDs per area. Each node appears at most once; nodes you leave out are
  open in no area. Without a default the view starts empty and people open the nodes they want.
- `sizes` sets each split's first region in percent (10 to 90): `[left]` for 2 areas,
  `[top, top left, bottom left]` for 4. Leave it out for even splits.
- People can change their own screen without changing the default for others, and their screen
  remembers its own arrangement for each area count. A new default you set reaches people who
  have not arranged their own screen.
- A hidden tab is unmounted, so a component reloads when its tab is shown again. Values in
  shared state survive; values in React state do not.
- Small screens show one area: the person's one-area arrangement.

## Common mistakes

- Using `update_canvas` (which may cost money and bumps the version) just to move nodes.
- Guessing positions without reading `get_canvas` first.
- A node ID that is not on the canvas: the call fails with `unknown_nodes` and nothing changes.
- Arranging a canvas that is answered or closed: it fails with `canvas_closed`.
