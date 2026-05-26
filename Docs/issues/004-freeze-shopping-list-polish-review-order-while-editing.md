# Freeze shopping list polish review order while editing

Type: AFK
Labels: needs-triage
Source: `Docs/prd/shopping-list-store-walk-order.md`

## What to build

Initialize **Shopping list polish review** from sorted consolidated lines, then keep the editable row order fixed while the user edits so the review starts in store order without fields jumping as names change.

## Acceptance criteria

- [ ] Pending-review lines are sorted once when **Shopping list polish review** opens.
- [ ] Editing `name`, `quantity`, or `unit` on a review line does not live re-sort the editable row order.
- [ ] Confirming review edits produces a final **Consolidated shopping list** display in **Shopping list store walk order**.
- [ ] The edit flow for a **Saved consolidated shopping list** opens review from sorted saved lines and also keeps row order fixed while editing.
- [ ] **Shopping list polish diff** and inline hints continue to attach to the correct line IDs after sorting.
- [ ] No visible category headers, labels, or UI grouping are added.
- [ ] Unit or component tests cover review entry order, stable row order after edits, confirm behavior, and saved-list edit entry.

## Blocked by

- `Docs/issues/002-sort-all-consolidation-results-at-server-boundaries.md`
- `Docs/issues/003-sort-saved-consolidated-shopping-lists-on-load-and-save.md`
