---
name: build-app
description: Build a complete app on a CanvasView canvas from several custom components that share state, and give components live data from an outside service through an owner-approved data source. Covers the app contract, the build order, useData and npm packages.
---

# Build an app

An app is several component nodes on one canvas that work together. Write each component as the
build-component skill describes; this skill covers what holds them together.

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

## Live data from a data source

A component can read from (and, if the owner allowed it, write to) a service the account owner
approved in settings. CanvasView makes the call and adds its secret headers; the frame still has
no network. Call `list_data_sources` for the names, hosts and methods; if one is missing, call
`request_data_source` and ask the person to approve it. You cannot create a source or see secrets.
Declare each source the canvas uses, `"dataSources": ["orders"]`, or the write fails with
`unknown_data_source`. A request shows in the owner's notifications as an action item;
`list_notifications` (read-only) tells you whether it is still waiting, or that a source a canvas
declares was removed.

A canvas that declares a data source needs sign-in by default, because anyone who can open it can call
the source through CanvasView. Tell the person their viewers will sign in, and set `access` to `link`
only when they ask for an open link.

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
code such as `data_source_not_declared`, `invalid_data_path` or `rate_limit`.

## npm packages

When the kit is not enough (3D, maps, specialised charts), declare npm packages on the node with
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

