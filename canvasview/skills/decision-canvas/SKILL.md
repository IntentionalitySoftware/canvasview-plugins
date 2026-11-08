---
name: decision-canvas
description: Create a CanvasView decision canvas when the user asks for a shared human decision, then retrieve the structured answer.
---

1. Read the available widgets with `get_kit_reference`.
2. Choose a unique idempotency key for this decision.
3. Create the canvas with the question, relevant evidence, and an object answer schema.
4. Give the user the returned URL.
5. Use `get_answers` or `wait_for_answer` to retrieve the submission.

Send only the data needed for the decision. Use sample data for connection checks. If the create outcome is unknown, use `find_canvas_by_key` before retrying. Keep the same idempotency key for a retry. If credits are insufficient, ask the user to refill.
