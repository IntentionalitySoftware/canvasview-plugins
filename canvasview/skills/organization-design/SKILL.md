---
name: organization-design
description: Use before building, changing or restyling any CanvasView component or canvas. Reads the design the organization chose for its canvases from CanvasView, as its design-system skill, and follows it.
---

# Follow the organization's design

An Admin can choose how the organization's canvases look. CanvasView writes that choice as a skill
named design-system and serves it to the organization's own agents. This skill only fetches it.

1. Call `get_skill` with `{ "name": "design-system" }`.
2. An answer with `text` holds a complete skill. Read it and follow it for every component and
   canvas you build here. Where it and the build-component skill differ, it wins.
3. An answer with `found: false` means the organization chose no design. Carry on with the
   neutral kit.

Read it again at the start of each new piece of work: an Admin can change the design at any time,
and canvases that use the kit's classes follow the change by themselves.
