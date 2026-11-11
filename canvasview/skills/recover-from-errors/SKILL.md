---
name: recover-from-errors
description: Recover when a CanvasView tool call fails or its outcome is unknown. Covers idempotent retries, find_canvas_by_key, version conflicts, payment and spending-cap errors, rate limits, validation and compile errors, and an out-of-date plugin.
---

# Recover from errors

A failed call returns `isError: true` with JSON text `{ "error": "<code>", "message": "..." }`.
The message says what to change. Invalid input adds `issues`, a list of `{ path, message }`.
Every code is listed in [errors.md](../../reference/errors.md).

## The outcome is unknown (timeout, dropped connection, `internal_error`)

Never create a second canvas with a new key. Instead:

1. Call `find_canvas_by_key` with the original `idempotencyKey`.
   - It returns the original result (`id`, `url`, ...): the canvas exists. Use it.
   - `{ "status": "pending" }`: the first call is still running. Wait a few seconds, check again.
   - `{ "status": "not_found" }`: nothing was created. Retry `create_canvas`.
2. Retry with the **same key and the same input**. A repeat returns the first result and never
   charges twice.

| Code | Meaning | What to do |
| --- | --- | --- |
| `idempotency_conflict` | This key was used with different input | Use the original input, or a new key if you really mean a new canvas |
| `request_in_flight` | A paid call with this key is still running | Wait, then retry with the original key |
| `internal_error` | The server failed | Retry with the original key |

## Version conflicts

`update_canvas` and `patch_canvas` need `baseVersion`, the version you last read. `version_conflict`
means the canvas changed since then. Call `get_canvas`, reapply your change to the current spec, and send
it with the new version. Do not blindly resend your old spec over someone else's change.
Remember `arrange_canvas`, `set_canvas_state` and `set_canvas_access` do not change the version.
A patch whose outcome is unknown can be retried with the same `baseVersion` and operations: it
returns the first result and charges once. `invalid_patch` names the failing operation's index;
nothing was changed, so fix that operation and send the whole patch again.

## Money and limits

Creating a canvas costs $0.50. Each canvas includes 10 updates; after that each update costs $0.05.
`get_balance` returns the balance in micro-USD (1,000,000 is $1).

| Code | Meaning | What to do |
| --- | --- | --- |
| `insufficient_credits` | The account cannot pay for this call | Tell the person; they can refill at https://app.canvasview.dev/settings/billing. Do not retry until they say so |
| `spend_cap` | The daily spending cap for the account or this API key is reached | Tell the person; they can raise the daily cap on the same page, or wait for the next day |
| `payment_disputed` | A payment is under dispute | Stop. The person should contact support@canvasview.dev |
| `rate_limit` | Too many calls | Wait one second, then retry once. Slow down rather than retrying in a loop |
| `account_pending` | The account is new and waiting for review | Tell the person; CanvasView emails them when it is approved. Meanwhile only `list_examples`, `get_example`, `get_kit_reference`, `list_widgets`, `validate_canvas` and `get_balance` work. Do not retry other tools until they say it is approved |
| `account_declined` | The account was not approved | Stop. The person can contact support@canvasview.dev |

Nothing is charged when a call fails these checks or fails validation.

## The input is wrong

- Validate first: `validate_canvas` takes the same input, reports every issue at once (with paths
  such as `nodes[2].data.rows`) and charges nothing. Fix them all, validate again, then retry.
- `invalid_input`: read each `issues[].path` (for example `nodes.2.data`) and its message, fix
  exactly that, and retry with the same key. Check props against [kit.md](../../reference/kit.md).
- `component_compile_failed`: the message names the node and line, such as
  `ideas, line 3: Import only react or @canvasview/kit, not "lodash".` See the build-component skill.
- `component_not_found`: a `ref` names no saved component. Run `search_components`, or send `source`.
- `payload_too_large`: the canvas is over 1 MB. Send less data: summarise, or keep the rows
  that matter.
- `unknown_nodes`: `arrange_canvas` named a node that is not on the canvas. Read `get_canvas`.

## The canvas is not available

- `canvas_closed`: it was answered (without `stayOpen`), closed, or expired, and accepts no
  changes. Create a new canvas if the work must continue.
- `canvas_not_found`: wrong ID, another account's canvas, or expired long ago. Use `list_canvases`.
- `read_only` on `set_canvas_state`: the canvas is no longer active.

## Signing in

- `unauthorized`: the connection is not signed in. Ask the person to sign in again from their
  client's MCP settings (in Claude Code, `/mcp`), or to check the API key they configured.
- `connection_revoked`: someone disconnected this client in CanvasView. The person has to
  reconnect it; do not try to work around it.

## Out-of-date plugin

`get_kit_reference` returns `plugin.latest`, the current plugin version. This plugin's version
is at the top of [tools.md](../../reference/tools.md). If `plugin.latest` is newer, tell the
person to update the CanvasView plugin; tools or blocks may have changed. The server is the
source of truth: when a tool or prop here disagrees with what the server says, follow the
server.

## When CanvasView cannot do something

If a capability is missing, say so to the person and send a short description with
`send_feedback`. Never put customer data in feedback.
