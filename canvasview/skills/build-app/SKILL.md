---
name: build-app
description: Build a complete app on a CanvasView canvas from several custom components that share state or open one another (an inbox that opens each email), and give components live data from an outside service through a Lead-approved data source. Covers the app contract, the build order, opens and instances, useData and npm packages.
---

# Build an app

An app is several component nodes on one canvas that work together. Write each component as the
build-component skill describes; this skill covers what holds them together. For a button that
has your agent send an email or post outside the canvas, see the messages skill.

## Several components, one contract

When several components work together through shared state, write the contract first, so the
parts cannot drift. The canvas enforces it. Work in this order:

1. **Write the contract** in the spec's `contract`: `state` maps each key (or a prefix such as
   `inputs.*` or `votes:*`) to `{ schema, writers }`, where `schema` uses the template parameter
   subset and `writers` lists node ids or is `"any"`. `roles` gives each node `{ purpose, reads, writes }`.
2. **Validate** with `validate_canvas`. It reports a role for a missing node, an undeclared key
   and a write the writers do not allow, and warns when a component's source uses a literal key
   its role does not list (`severity: "warning"`, never a failure).
3. **Create with placeholder nodes**: a tiny component per role (`export default () => null`),
   with the final node ids, so the roles hold from the start.
4. **Add components one at a time** with `patch_canvas` `update_node { id, source }`, and
   validate each before you send it.
5. **Save it** with `save_template` (`fromCanvasId`): the template keeps the contract, and
   `search_templates` finds it by role purposes and state keys.

At write time the canvas refuses an undeclared key (`undeclared_key`), a value that does not fit
(`schema_mismatch`) and a write from a node that is not a writer (`not_a_writer`); the component's
`error` shows the reason. The agent may write any declared key. `null` always fits and clears a key.
Changing the contract while stored values no longer fit fails with `state_conflict` unless the same
request sets or clears them (`state` on `update_canvas`, `set_state` in a patch). Removing a node the
contract names fails unless the patch also sets the contract. Reading is never restricted. See
[contract-app.json](../../examples/contract-app.json).

## A parent that opens other components

A component can open other components beside it, for everyone: an inbox lists emails, and clicking
one opens it in an email reader. Each opened item is an instance. Declare on the parent's node what
it can open:

```json
{ "id": "inbox", "kind": "component", "source": "...", "data": { "emails": [] },
  "opens": { "email": { "ref": "email-reader", "key": "emailId" } } }
```

- `ref` is a saved component: save the reader with `save_component` first, or the canvas is refused
  with `component_not_found`. An instance renders it with the open input as its `data`.
- `key` names the input field that tells instances apart. Opening the same key again brings back the
  one there is, restored if it was minimized or closed, with the new input as its data; its id, state
  and place stay.
- Anyone who can open the canvas, link viewers too, can open, minimize, restore and close instances.
  Add `"access": "named"` to keep that to invited people and members. Removing one always needs an
  invited person or a member. A declaration may hold its own `opens`, three levels deep.
- A component opens only the types its node declares.

```tsx
import { canvas } from "@canvasview/kit";

type Email = { emailId: string; from: string; subject: string; body: string };

export default function Inbox({ data }: { data: { emails: Email[] } }) {
  return (
    <ul>{data.emails.map((email) => (
      <li key={email.emailId}>
        <button type="button" onClick={() => void canvas.open("email", email).catch(() => undefined)}>{email.subject}</button>
        <button type="button" onClick={() => void canvas.remove("email", email.emailId).catch(() => undefined)}>Archive</button>
      </li>
    ))}</ul>
  );
}
```

`canvas.open(type, input)` resolves with the instance and rejects with an Error carrying `reason`;
`canvas.remove(type, key)` removes one of the parent's own. `useOpened("email")` gives the parent's
instances with their status, live, to mark which emails are open; `useOpen("email")` gives
`{ open, pending, error, available }` like `useTool` and never rejects. The reader is an ordinary
component: `export default function EmailReader({ data }) { ... }`.

State is scoped the same way: in an instance `useSharedState("draft", "")` is its own; `useFamilyState` is shared
by the parent and all under it; `useCanvasState` is canvas-wide, as the parent's `useSharedState` stays; the parent
reads each email's with `useOpenedState("email", "draft")`. Removing an instance erases its keys; a contract declares them in `scopes`.

What people open is live state: no version, no charge. `get_canvas` lists `instances` with their data and
`nodeStatus`; `wait_for_message` wakes on `canvas.instance_changed`. `change_instances` opens, closes, removes, renames
and colors instances and nodes: a color (`#rrggbb`, set there once the canvas exists, never in the spec) is a
soft shadow whose meaning is yours to say, such as who an item is for. `remove_node` takes its instances and state.
A canvas holds 200 instances, a parent 50, each input up to 16 KB. See [inbox.json](../../examples/inbox.json), which lists the reader to save first.

## Live data from a data source

A component can read from (and, if allowed, write to) a service a Lead of the canvas's workspace
approved in its settings; a canvas reaches only its own workspace's sources. CanvasView makes the
call and adds its secret headers; the frame still has no network. Call `list_data_sources` for the names, hosts and methods; if one is missing, call
`request_data_source` and ask a Lead to approve it. You cannot create a source or see secrets.
Declare each source the canvas uses, `"dataSources": ["orders"]`, or the write fails with
`unknown_data_source`. A request shows in the Leads' notifications as an action item;
`list_notifications` (read-only) tells you whether it is still waiting, or that a source a canvas
declares was removed.

A canvas that declares a data source needs sign-in by default, because anyone who can open it can read
the source through CanvasView. Tell the person their viewers will sign in, and set `access` to `link`
only when they ask for an open link.

Writes (POST, PUT, PATCH, DELETE) need someone the owner named: a person invited as participant or
above, a member who has the canvas through its visibility, the owner, a Lead or an Admin. Anyone with only
the link, signed in or not, and anyone invited as a viewer, can read and is refused a write with
`invite_required` or `forbidden`. A button that writes is for invited people. On a public canvas,
collect answers or shared state instead, and act on them yourself or with a tool. Each write is
recorded for the canvas's managers with who sent it, the source, the method, the path and the
status (`get_action_log`); never the query or the body.

```tsx
import { DataTable, fetchData, useData } from "@canvasview/kit";

export default function Orders() {
  const { data, error, refresh } = useData<{ rows: Record<string, string>[] }>("orders", { path: "/open", query: { limit: 50 } });
  if (error) return <p role="alert">Could not load orders ({error.code}).</p>;
  const close = () => void fetchData("orders", { path: "/close", method: "POST", body: { all: true } }).then(refresh);
  return <div><DataTable rows={data?.rows ?? []} /><button type="button" onClick={close}>Close all</button></div>;
}
```

Paths stay under the source's base URL and prefix. Limits: 256 KB sent, 1 MB received, JSON or
text only, 10 seconds, no redirects, 60 requests a minute per viewer. A refused call has an error
code such as `data_source_not_declared`, `invalid_data_path`, `invite_required` or `rate_limit`.

## npm packages

When the kit is not enough (3D, maps, specialized charts), declare npm packages on the node with
exact versions and import them:

```json
{ "id": "scene", "kind": "component", "packages": { "three": "0.170.0", "@react-three/fiber": "9.8.2" },
  "source": "import * as THREE from \"three\";\nimport { Canvas, useFrame } from \"@react-three/fiber\";\n..." }
```

- Exact versions only: `"1.2.3"`, never `"^1.2.3"`, `"latest"`, a URL or a git spec. Up to 12.
- Each version must exist on npm, be more than 3 days old, not be deprecated and have no
  malware advisory. A refusal names the package and what to use instead, at
  `nodes[i].packages.<name>`; `validate_canvas` reports the same problems for free.
- Declare peer dependencies too: React Three Fiber needs `three`. React and ReactDOM come from the
  sandbox (React 19), so never declare them.
- Subpaths of a declared package work: `three/addons/controls/OrbitControls.js`.
- CanvasView bundles the packages when the canvas is saved; at most 3 MB per component. The first
  use of a large package takes a few seconds; later canvases reuse the bundle.
- Package code runs only inside the sandbox, so the rules below apply to it too: no network.
