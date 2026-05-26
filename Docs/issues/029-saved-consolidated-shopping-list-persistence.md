# 029 — Saved consolidated shopping list persistence

## Parent

[PRD: Shopping list human review and persistence](../prd/shopping-list-human-review-and-persistence.md)

## What to build

Persist **Saved consolidated shopping list** on the **Saved Weekplan** row: migration adds JSON column; repository load/save with **Planning Principal** checks. **GET** / **PUT** `/api/v1/saved-weekplans/:id/consolidated-shopping-list`—server sets **Shopping list source fingerprint** from canonical `body` on PUT; client never sends fingerprint. **Saved Weekplan** **GET** embeds `hasSavedShoppingList` and `shoppingListDeprecated`. **Shopping list polish confirm** calls **PUT**. Valid saved list shows in **Consolidated shopping list** default view without running AI.

## Acceptance criteria

- [ ] Supabase migration adds nullable `consolidated_shopping_list` (or agreed name) on `meal_week_templates`
- [ ] Repository round-trip stores `lines`, `sourceFingerprint`, `confirmedAt`
- [ ] **PUT** validates line shape and principal access; **GET** returns 404 or empty when absent
- [ ] Plan **GET** includes `hasSavedShoppingList` and `shoppingListDeprecated` (deprecated when stored fingerprint ≠ current body hash)
- [ ] Review confirm persists via **PUT**; revisiting consolidated view loads saved list without **Consolidate action**
- [ ] API and repository unit tests; composable tests for load + save flow
- [ ] Anonymous and authenticated owners can save own plans per **Shopping list consolidation access**

## Blocked by

- [028 — Shopping list polish review UI (session confirm)](./028-shopping-list-polish-review-ui-session-confirm.md)

## User stories covered

12, 16, 18–20, 25–28
