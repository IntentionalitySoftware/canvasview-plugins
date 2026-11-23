---
name: create-canvas
description: Create a CanvasView canvas when someone needs people to decide, review, approve or work on something together and the answer must come back to you. Covers choosing building blocks, the answer schema, reusing saved components and sending the link.
---

# Create a canvas

A canvas is a page of components that people open by link. You build it with `create_canvas`,
send the link, and read back structured answers and shared state. Creating a canvas costs money
(see `get_balance`), so get it right the first time.

## 1. Start from the purpose

Before you write any nodes, answer three questions, in your head or with the person:

- **What must come back?** A choice, a yes or no, a few numbers, a ticked list, free text.
  This becomes the `answerSchema`. If nothing comes back and people simply work on it
  together, make a canvas with no answer form (below).
- **Who will use it?** One decider, a reviewer, a whole team at once. This decides the access
  mode (see the work-with-people skill). Component interactions are shared. Mark personal drafts explicitly private.
- **What do they need to see to answer well?** Only the evidence that changes the answer.
  Leave out everything else, and never send secrets or data the person should not see.

Then pick the shape:

- **Decision canvas**: one question, evidence, and an input block that drafts the answer.
  This is the default.
- **A canvas people keep working in**: leave out `answerSchema` (and `question` if the title says enough). People work
  over time (a board, a shared list, a live table); there is no answer panel, the canvas never
  becomes `answered`, and it stays open until you close it or it expires. Keep values in shared
  state automatically. Give a value a `stateKey` to read it by name with `get_canvas_state`; refresh data with `patch_canvas`.
  Blocks there need no `field`: there is no answer to draft into.
- **Open decision**: an `answerSchema` with `stayOpen: true` accepts any number of answers.
- **Your agent acts outside the canvas** (sends an email): message types on a component, in the messages skill.

## Reuse a whole canvas

When the request repeats an earlier kind of canvas (the same review for another customer, this
week's version of last week's check), call `search_templates` first. Read a match with `get_template`, then create
from it with `create_canvas { idempotencyKey, template: "<name>", content: {...} }`: content is keyed by block name and
checked before any charge, and `title`, `expiresInHours`, `stayOpen` and `access` still override the template's.
It lists CanvasView's own templates too (`fromCanvasView`): read one's recipe before offering it.

When a canvas worked and will recur, save it as a recipe with `save_template`. Read the write-template skill first.

## 2. Reuse before you write

1. If the request resembles an earlier canvas, call `search_components` first (an empty
   query lists the most used). Reuse a match with `{ "kind": "component", "ref": "<name>", "data": {...} }`.
   `get_component` returns the source if you need to fork it.
2. Otherwise use the built-in building blocks as widget nodes. They cover most needs:

| Need | Block (widget) |
| --- | --- |
| Context, instructions | `Note` (`note@1`) |
| One record, labeled fields | `RecordDetail` (`facts@1`) |
| Rows of data | `DataTable` (`table@1`) |
| Trends, comparisons over time | `Chart` (`chart@1`) |
| Headline numbers with change | `MetricTiles` (`metric@1`) |
| Two to four options side by side | `Comparison` (`comparison@1`) |
| A contract or long text, a diff | `DocumentViewer` (`document@1`) |
| Dated events | `Timeline` (`timeline@1`) |
| A message thread to read; results of checks | `Conversation` (`conversation@1`); `StatusList` (`status-list@1`) |
| Pick one option | `Decision` (`decision@1`) |
| A few typed fields | `SchemaForm` (`form@1`) |
| Tasks with owners, to do, doing, done | `Checklist` (`checklist@1`), or `Board` (`board@1`) for cards in columns |
| Approve or reject a statement | `Approval` (`approval@1`) |
| Explore numbers live | `Calculator` (`calculator@1`) |

3. Write a new component only when no block fits, for example a custom interaction or a layout the blocks cannot express. Follow the build-component skill, and save it with `save_component` if reusable.
   First call `get_skill` with name `design-system`: if the organization chose a design, follow it.

Give each node, widget or component, a `title` in the reader's words, such as "Open tickets"; without one its heading is the widget type, or "Made by an agent" on a component.
Exact props for every block are in [kit.md](../../reference/kit.md) (also returned by `get_kit_reference`). Exact tool inputs are in [tools.md](../../reference/tools.md).

## 3. Wire answers correctly

Input blocks (`Decision`, `SchemaForm`, `Checklist`, `Approval`, `Calculator`) draft into the
answer panel when you give them `field`. Every `field` must be declared in `answerSchema`:

- `Decision` with `field: "choice"` → `choice` as a string, ideally an `enum` of the option values.
  With `requireReason: true` it also drafts `choiceReason`; declare that too.
- `Checklist` → an `array` with `items: { "type": "integer" }` (the indexes of the items done). People pick owners of its items and of `Board` cards from the workspace's people; to set one, give `owner` a person: `{ "id", "name" }` with an `id` from `list_canvas_people`, or `{ "name": "Acme legal", "external": true }` for an outsider. A plain name is refused.
- `Approval` and `Calculator` → an `object`.
- `SchemaForm` → an `object` in `field`, or with `spread: true` one answer field per property.

Mark only what you truly need as `required`: an answer missing a required field is rejected.
After the first answer the canvas becomes `answered` and accepts no more changes, unless you set `stayOpen: true`.

## 4. Create it

```json
{
  "idempotencyKey": "vendor-renewal-2026-11-acme-v1",
  "title": "Vendor renewal",
  "question": "Should we renew with Acme?",
  "nodes": [
    { "id": "context", "kind": "widget", "widget": "note@1", "data": { "markdown": "Contract ends **1 December**." } },
    { "id": "choice", "kind": "widget", "widget": "decision@1",
      "data": { "options": ["Renew", "Switch"], "field": "choice" } }
  ],
  "edges": [{ "from": "context", "to": "choice" }],
  "answerSchema": {
    "type": "object",
    "properties": { "choice": { "type": "string", "enum": ["Renew", "Switch"] } },
    "required": ["choice"]
  }
}
```

- **Idempotency key**: one unique key per canvas you intend to create, derived from the task
  (not random on every attempt). Retrying with the same key and the same input never creates
  or charges twice. Changing the input under the same key is an `idempotency_conflict`.
- Node `id`s are yours: short, stable, readable (`context`, `costs`, `choice`). Edges and `arrange_canvas` refer to them.
- `expiresInHours` defaults to a week (168) unless a Lead or an Admin changed it; the maximum is 2160 (90 days).
- `workspace` (an id or slug from `list_workspaces`) creates it there, else in your home workspace; it uses that workspace's saved components, templates and data sources.
- With edges, nodes are laid out top to bottom along them; without edges, in a grid.

The result has `id`, `url`, `version` and `unitsLeft` (included updates left).

## 5. Send the link

Give the person the `url` with one sentence on what you need from them and by when, then follow the work-with-people skill to wait for the answer, a message with an `answer` typed part in your feed (`wait_for_message { canvases: [canvas], contents: ["answer"] }`). A link gives View only, signed in or not: only people invited by address (`access.invited`, participant or above) and members of the organization who have the canvas answer, vote, comment or send from it, signed in. Invite by address everyone else who should take part.

## Start from an example, and validate first

Call `list_examples` and start from the closest with `get_example`: a complete, working `create_canvas`
input. Replace its `idempotencyKey` and sample data. Before `create_canvas`, `update_canvas` or
`patch_canvas`, send the same input to `validate_canvas`: it runs every check the real call runs, charges
nothing, and returns `issues` with a `path` into your input, or `priceMicroUsd` when valid. Fix them all.

- [decision-with-evidence.json](../../examples/decision-with-evidence.json): a vendor choice with evidence and a reason.
- [data-review.json](../../examples/data-review.json): metrics, table, chart and a verdict form.
- [approval.json](../../examples/approval.json): a document with highlights and an approval, invited people only.
- [group-poll.json](../../examples/group-poll.json): a live team poll; the organizer closes it and submits the result.
- [launch-board.json](../../examples/launch-board.json): a team board with no answer form, a board and a table to refresh.
- [custom-component-shared-state.json](../../examples/custom-component-shared-state.json): one custom component with `useSharedState`.
- [checklist-review.json](../../examples/checklist-review.json) and [calculator-decision.json](../../examples/calculator-decision.json): a shared checklist or calculator, then a decision.

## Common mistakes

- An input block's `field` missing from `answerSchema`, or the reason field forgotten.
- Writing a component for something `DataTable` or `Decision` already does.
- Sending the whole dataset when ten rows decide the question. The canvas limit is 1 MB.
- A new idempotency key on every retry, which can create and charge for duplicate canvases.
- Asking several unrelated questions on one canvas. Make one canvas per decision.
