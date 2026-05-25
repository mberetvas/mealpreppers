# Partial consolidation + edge cases

**Label:** `needs-triage`

## Parent

[PRD — Shopping list AI consolidation](../prd/shopping-list-ai-consolidation.md)

## What to build

Handle edge cases in **Shopping list consolidation** where plan data is incomplete, empty, or fully failed — both server-side in the consolidation service and client-side in the consolidated view.

**Shopping list partial consolidation (server + client):**
- When **Shopping list recipe resolution failure** leaves some recipes unloaded, consolidation runs on loaded **Recipe sections** only.
- The same incomplete warning visible in recipe sections view is shown in consolidated view.
- `warnings[]` in the API response includes the partial resolution warning.

**Shopping list empty plan (server + client):**
- Plan loaded but every slot has no recipe — consolidation has no input.
- API returns a meaningful empty state (not a fake consolidated list).
- Client shows direction to add recipes first, consistent with recipe sections empty plan state.

**Shopping list total recipe resolution failure (server + client):**
- Every referenced recipe failed to load — plan title visible, consolidation is meaningless.
- Consolidate action is unavailable or clearly indicates no sections to consolidate.
- Warning banner matches recipe sections total failure state.

**Access failure:**
- Plan not found / forbidden returns the same HTTP status as plan GET (handled by `withPlanningHandler`).
- Consistent with existing access semantics — no new auth paths.

## Acceptance criteria

- [ ] Partial recipe resolution: consolidation uses only loaded sections; incomplete warning in `warnings[]` and visible in UI
- [ ] Empty plan: API returns empty consolidated list with appropriate status; client shows add-recipes guidance
- [ ] Total recipe resolution failure: consolidate action disabled or hidden; warning banner matches recipe sections total failure
- [ ] Access errors consistent with existing `withPlanningHandler` behavior (no regression)
- [ ] Tests: service tests for partial failure, total failure, empty plan inputs; component tests for warning display and disabled/hidden consolidate states

## Blocked by

- [021 — Consolidation API with baseline fallback](./021-consolidation-api-baseline-fallback.md)
- [023 — Client view mode toggle + consolidated view](./023-client-view-mode-consolidated-view.md)
