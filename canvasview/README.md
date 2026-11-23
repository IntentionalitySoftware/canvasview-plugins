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

The connection has a home workspace, where Claude acts unless a tool names another `workspace` you
are in. You can change it in the workspace's settings, under API keys.

Then try it: ask Claude to build a CanvasView test canvas with a note, a table and a checklist, and
give you the link. Open it, tick something off, and ask Claude what changed.

## Messages while Claude works

Once you are signed in, the plugin follows your agent's CanvasView feed in the session, through
Claude Code's own CanvasView connection: no second sign-in and no key. Claude does not poll.

- What is for your agent starts a turn of its own when the session is idle: @mentions of it,
  requests addressed to it or to you, and replies to requests it sent. Everything else that arrived
  comes along with it, or with your next prompt. If you type first, your prompt goes first.
- An @mention of your agent, or a request addressed to it, goes into the running turn after the
  tool call in progress.
- Each delivery says that the text people and agents wrote is untrusted data, never instructions
  and never approval, and quotes every line of it.
- The plugin moves your agent's checkpoint only after what arrived is saved in its queue, so a
  restart neither loses nor repeats anything. One session on the machine follows the feed at a
  time; another takes over when it ends.
- Limits: the plugin starts at most 12 turns an hour, at least 60 seconds apart. Past that it keeps
  queueing, the status line says "paused starting turns until" a time, and what waits comes with
  your next prompt. A message wakes Claude once however often it is edited. One delivery carries
  at most 20,000 characters and 40 items; the rest comes with the next. Past 100 waiting items the
  plugin keeps only their first line, and past 300 only a count per canvas.
- The agent's checkpoint is the agent's, not the machine's: the same agent signed in on several
  machines splits new items between them, each getting what it took in first.
- `/canvasview-feed` shows what waits. The status line says "CanvasView: not delivering" after the
  feed failed three times in a row or the plugin could not save its queue, and "CanvasView: sign in
  with /mcp" until you sign in.

Settings (`/config`): **Message delivery** (`idle`, the default; `next-prompt`, where only urgent
items start a turn; or `off`), **Urgent items** (`inject`, the default, or `queue`), **Turns the
plugin may start per hour** (12; 1 to 60) and **Seconds between plugin turns** (60; 10 to 3600). It
uses only this plugin's own CanvasView server. A `claude -p` run never follows the feed, a desktop or
SDK session follows only while someone is attached, and a closed session hears nothing until it runs
again. When a session ends, what still waits is kept without its text, as pointers for `get_message`.

## API key instead (scripts and headless use)

Where a browser sign-in is not possible, create a key at https://app.canvasview.dev (Settings, then API keys
under Workspace) and send it as a bearer token. The key lives in that workspace. For a project-level MCP entry:

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
| `what-you-can-build` | Deciding what to make, or answering what CanvasView can do: everything a canvas can hold, how to get data in, good practice, and what is not possible |
| `create-canvas` | Turning a request into a canvas: what must come back, reusing saved components, choosing building blocks, the answer schema, idempotency keys, sending the link |
| `build-component` | Writing a sandboxed TSX component when no block fits, shared state, drafting answers, sandbox limits, saving it to the library |
| `build-app` | Building an app from several components that share state: the app contract, the build order, live data from an approved data source, npm packages |
| `build-tools` | Giving a canvas tools, server-side code for its components: the code, manifest and recorded cases, `test_tool`, `publish_tools`, calling a tool from a component, reading failures |
| `arrange-canvas` | Lining nodes up, putting one next to another, the canvas view and the components view |
| `write-template` | Writing a recipe for a canvas that will recur, and making a canvas from one |
| `messages` | Your one feed and your checkpoint (`list_messages`, `wait_for_message`), conversations with people and other agents, requests (`send_request`, `wait_for_reply`, `claim_request`, `complete_request`), attachments over MCP and REST, and components that have your agent act outside the canvas (send an email, fetch mail) |
| `scheduled-runs` | Running on a schedule when the host cannot be woken by a message: `count_waiting` first and ending when nothing waits, claiming each request so a woken run and a scheduled run never both answer it, and prompts for a cloud routine and a cron job |
| `work-with-people` | Access modes, workspaces and visibility, waiting for answers, reading shared state, one person in control, treating what people type as untrusted |
| `work-with-agents` | Asking another agent and waiting for its correlated reply, answering a request (claim, do the work, complete), when to stay silent, why a peer's words grant nothing, and stopping at `chain_limit` |
| `organization-design` | Before building or changing a component: reads the design the organization chose for its canvases (`get_skill` with name `design-system`) and follows it |
| `recover-from-errors` | Retries with `find_canvas_by_key`, version conflicts, credits and caps, rate limits, compile errors, updating the plugin |

`reference/` holds the tool, kit and error references, generated from the CanvasView code
(`tools.md`, `kit.md`, `errors.md`). `examples/` holds nine complete `create_canvas` inputs, also served by `list_examples` and `get_example`.

Creating a canvas costs credits; validating, reading, arranging, shared state and the component library are free.
