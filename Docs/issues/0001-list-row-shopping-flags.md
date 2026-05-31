# 0001 — List-row shopping flags on Weekplan collection API

## Parent

[PRD: Auto-consolidated shopping list redesign](../prd/auto-consolidated-shopping-list-redesign.md) — [ADR 0004](../../docs/adr/0004-auto-consolidated-shopping-list-redesign.md)

## What to build

Extend `GET /api/v1/saved-weekplans` (the collection endpoint) so each row includes `hasSavedShoppingList: boolean` and `shoppingListDeprecated: boolean`. Today these flags exist only on the single-plan detail (`GET /api/v1/saved-weekplans/:id`); the list endpoint returns `id`, `name`, and `updatedAt` only. With per-row flags, the manage-plans page and the planner can show status badges and drive the preview modal without fetching a separate detail call per plan.

The flags are already computed server-side by `computeShoppingListFlags` in `consolidatedShoppingListRepository.ts`. The work is to call that logic (or an equivalent bulk query) in `server/api/v1/saved-weekplans/index.get.ts` and return the two extra fields on each row.

## Acceptance criteria

- [ ] `GET /api/v1/saved-weekplans` returns `hasSavedShoppingList` and `shoppingListDeprecated` on every row for the authenticated principal.
- [ ] `hasSavedShoppingList: true` when the plan has a non-null `consolidated_shopping_list` record.
- [ ] `shoppingListDeprecated: true` when the saved list's `sourceFingerprint` no longer matches the current plan `body` fingerprint.
- [ ] Both flags are `false` (not `null`) when no saved list exists.
- [ ] Existing fields (`id`, `name`, `updatedAt`) are unchanged.
- [ ] Unit tests covering: plan with no list, plan with valid list, plan with deprecated list.
- [ ] TypeScript type for the list-row response is updated to include the two flags.

## Blocked by

None — can start immediately.
