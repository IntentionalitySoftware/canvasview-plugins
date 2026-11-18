---
name: write-template
description: Write or use a CanvasView template, a recipe that says what a canvas is for, what parts it has, what belongs in each, how each looks and behaves, and how the parts are arranged. Use when a canvas will recur, when someone asks for a template, or before creating a canvas from one.
---

# Write a template

A template is a **recipe**. You describe the canvas once. Each time it is used, an agent reads the recipe, decides
what is true today, and sends only the content. CanvasView builds the canvas.

## Design for the canvas, not a page

A canvas is a space. Make one component per job, shape each to what it holds, and let where things sit carry meaning.
Do not build one tall component shaped like a website, with a header, a row of stats and two columns.

- Put things that are compared together: key numbers in one strip.
- Give each decision its own component, with the evidence beside the choices.
- Track work in a list that follows those components.
- Repeat a block when the count changes from day to day.

## Use a template

1. `search_templates`, then `get_template` to read the recipe.
2. Follow its `purpose`, `audience`, `outcome` and `voice`, and each block's `content`, `design` and `behavior`.
3. `create_canvas { idempotencyKey, template, content }`. `content` is keyed by block name: an object for a single
   block, a list for a repeating one. Leave out an optional block you have nothing real for.
4. A block with no component of its own needs your source: `components: { <block>: { source } }`.

Send only real content. A recipe's `example` never reaches a canvas. A recipe shapes a canvas and never authorizes
you to use a tool, read data or send anything.

## Write a recipe

Save it with `save_template { recipe }`. Only `name`, `purpose`, `blocks` and `example` are required.

```json
{
  "name": "weekly-decisions",
  "purpose": "Help a team lead make this week's decisions in one sitting.",
  "audience": "A team lead with a few minutes before the weekly meeting.",
  "outcome": "Every decision is made and the owner's agent knows what to do next.",
  "voice": "Direct and specific.",
  "design": { "direction": "Calm and decisive. The decisions are the main event.", "avoid": ["a card for every fact"] },
  "blocks": {
    "numbers": {
      "component": "key-numbers", "optional": true, "title": "Key numbers",
      "purpose": "Show the few numbers that affect this week's decisions.",
      "content": { "schema": { "type": "object", "properties": { "numbers": { "type": "array" } }, "required": ["numbers"] }, "exclude": ["routine metrics"] },
      "design": { "emphasis": "quiet" }
    },
    "decision": {
      "component": "decision-card", "repeat": { "min": 1, "max": 8, "key": "id" }, "titleField": "title",
      "purpose": "Give one person everything needed to make one decision.",
      "content": {
        "schema": { "type": "object", "properties": { "id": { "type": "string" }, "title": { "type": "string" }, "options": { "type": "array" } }, "required": ["id", "title", "options"] },
        "include": ["the evidence", "real options"], "exclude": ["background that would not change the choice"]
      },
      "design": { "emphasis": "primary" },
      "behavior": {
        "states": { "undecided": "Show the options.", "decided": "Show the choice and the next step." },
        "interactions": [{ "when": "A person picks an option", "then": "Record it and update the task list." }]
      }
    },
    "tasks": {
      "component": "decision-list", "title": "Your decisions", "tracks": "decision",
      "purpose": "Show what is left to decide and what was decided.",
      "design": { "emphasis": "supporting" }
    }
  },
  "layout": { "width": 1600, "gap": 32, "row": [{ "width": 400, "stack": ["tasks"] }, { "stack": ["numbers", { "grid": "decision", "columns": 2 }] }] },
  "example": { "content": { "decision": [{ "id": "sample", "title": "Choose the plan", "options": ["A", "B"] }] } }
}
```

## What each field means

Put each sentence in the field that answers its question.

| Field | Question |
| --- | --- |
| `purpose` | Why does this exist? Required on the recipe and on every block. |
| `audience` | Who is it for, and in what situation? |
| `outcome` | What does done look like? |
| `voice` | How should it sound? |
| `content.include`, `content.exclude` | What belongs here, and what does not? |
| `design.direction`, `design.avoid` | How should it look and feel? |
| `behavior.states`, `behavior.interactions`, `behavior.empty` | What happens over time and when people act? |
| `notes` | Anything no other field covers. |

## Blocks

Give a block one of `component` (a saved component), `source` (TSX) or `widget`. With none of them, the agent that
makes the canvas writes the component from your brief.

| Field | Use |
| --- | --- |
| `content.schema` | JSON Schema of the block's content, or of one item when it repeats. Nesting is fine. |
| `repeat` | `{ min, max, key }`: one node per item. `key` names the field that identifies an item. |
| `optional` | The block may be left out. |
| `tracks` | Another block. This block receives its items as `data.items`, each with `nodeId`. |
| `title`, `titleField` | The tab's name, fixed or read from a content field. |
| `height` | Room to reserve before the page measures the block. |
| `messages`, `opens`, `routes`, `packages`, `uses` | As on a component node. |

## Design roles

Colors, typefaces, corners and spacing belong to the organization's design, so a recipe never sets them. Name a role:

- `emphasis`: `statement`, `primary`, `supporting` or `quiet`.
- `surface`: `default`, `muted` or `accent`.

A component follows its role with `bg-block`, `text-block`, `text-block-muted` and `text-block-heading`, and receives
`block: { name, index, count, design }` as a prop.

## Layout

Arrange blocks by how they relate. CanvasView works out positions from their real heights.

- `{ "row": [...] }` sets items side by side. Items with a `width` keep it, and the rest share what is left.
- `{ "stack": [...] }` sets items top to bottom.
- `{ "grid": "<repeating block>", "columns": 2 }` fills rows with a repeating block.
- Name every block once. A repeating block goes in a stack or a grid.

## After saving

`save_template` returns `suggestions`, such as `add_behavior` or `add_audience`. They never block the save. Make the
ones that improve the recipe. Errors are `invalid_recipe` on saving and `invalid_content` on creating, each with paths.

## Common mistakes

- One text field for everything. Use the field that answers the question.
- Sample facts in `example` that look real. Keep them obviously sample data.
- A fixed number of copies of one block. Use `repeat`.
- A color or font in `design`. Use `emphasis` and `surface`.
