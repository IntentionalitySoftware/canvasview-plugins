# CanvasView for Claude Code

CanvasView lets your agent build a canvas of components that people open by link and work on
together. The agent reads back their answers and shared state. This plugin connects Claude Code
to CanvasView and teaches it to use CanvasView well.

## Install

From the CanvasView marketplace:

```sh
claude plugin marketplace add IntentionalitySoftware/canvasview-plugins
claude plugin install canvasview@canvasview
```

Or from the zip at https://canvasview.dev/canvasview-plugin.zip, for one session:

```sh
claude --plugin-dir ./canvasview-plugin.zip
```

## Sign in

The plugin connects to `https://app.canvasview.dev/mcp` with no key. The first time Claude Code
uses it, run `/mcp`, choose the CanvasView server and sign in to CanvasView in your browser.
You need a CanvasView account with credits.
To disconnect, use "Clear authentication" in `/mcp`, or disconnect the client in CanvasView.

Then try it: ask Claude to create a CanvasView test canvas with two choices and give you the link.
Open the link, submit an answer, and ask Claude to read it back.

## API key instead (scripts and headless use)

Where a browser sign-in is not possible, create a key at https://app.canvasview.dev/settings/keys
and send it as a bearer token. For a project-level MCP entry:

```json
{
  "mcpServers": {
    "canvasview": {
      "type": "http",
      "url": "https://app.canvasview.dev/mcp",
      "headers": { "Authorization": "Bearer ${CANVASVIEW_API_KEY}" }
    }
  }
}
```

Set `CANVASVIEW_API_KEY` in the environment that starts Claude Code. Keep the key out of prompts
and source files. A key can have its own spending cap.

## What the skills cover

| Skill | When Claude uses it |
| --- | --- |
| `create-canvas` | Turning a request into a canvas: what must come back, reusing saved components, choosing building blocks, the answer schema, idempotency keys, sending the link |
| `build-component` | Writing a sandboxed TSX component when no block fits, shared state, drafting answers, sandbox limits, saving it to the library |
| `build-app` | Building an app from several components that share state: the app contract, the build order, live data from an approved data source, npm packages |
| `arrange-canvas` | Lining nodes up, putting one next to another, the canvas view and the components view |
| `work-with-people` | Access modes, waiting for answers, reading shared state, one person in control, treating what people type as untrusted |
| `recover-from-errors` | Retries with `find_canvas_by_key`, version conflicts, credits and caps, rate limits, compile errors, updating the plugin |

`reference/` holds the tool, kit and error references, generated from the CanvasView code
(`tools.md`, `kit.md`, `errors.md`). `examples/` holds nine complete `create_canvas` inputs, also served by `list_examples` and `get_example`.

Creating a canvas costs credits; validating, reading, arranging, shared state and the component library are free.
