# 031 — Edit saved consolidated shopping list without AI

## Parent

[PRD: Shopping list human review and persistence](../prd/shopping-list-human-review-and-persistence.md)

## What to build

On a valid (non-deprecated) **Saved consolidated shopping list**, **Edit list** opens **Shopping list polish review** pre-filled from saved lines—no OpenRouter call. Reference tabs remain available. **Shopping list polish confirm** **PUT**s updates with a new `confirmedAt` and refreshed fingerprint from current `body`. Same edit constraints: `name`, `quantity`, `unit` on existing IDs; error-hint acknowledgment if hints are re-evaluated on save (define whether hints run on edit-only path or are skipped).

## Acceptance criteria

- [ ] **Edit list** visible when `hasSavedShoppingList && !shoppingListDeprecated`
- [ ] Edit flow does not call **POST consolidate** or incur OpenRouter cost
- [ ] Confirm **PUT** persists changes; reload shows updated lines
- [ ] Component test: edit → change line → confirm → persisted display
- [ ] Composable test: `editSaved` state does not clear saved list until confirm

## Blocked by

- [029 — Saved consolidated shopping list persistence](./029-saved-consolidated-shopping-list-persistence.md)

## User stories covered

17
