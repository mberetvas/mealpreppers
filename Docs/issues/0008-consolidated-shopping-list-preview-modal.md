# 0008 — Consolidated shopping list preview modal

## Parent

[PRD: Auto-consolidated shopping list redesign](../prd/auto-consolidated-shopping-list-redesign.md) — [ADR 0004](../../docs/adr/0004-auto-consolidated-shopping-list-redesign.md)

## What to build

Build `ConsolidatedShoppingListPreview` — a modal/sheet that gives a read-only, status-driven view of a plan's consolidated shopping list without leaving the manage-plans page or the planner. It never calls the consolidate API.

Three states driven by `hasSavedShoppingList` + `shoppingListDeprecated`:

| State | Content |
|-------|---------|
| **Ready** (`hasSavedShoppingList && !shoppingListDeprecated`) | Aisle-grouped lines via `ShoppingListAisleSection` (readonly); **Open full list** link |
| **Outdated** (`hasSavedShoppingList && shoppingListDeprecated`) | Outdated warning + **Open full list** link; no AI, no lines |
| **No list yet** (`!hasSavedShoppingList`) | Empty-state message + **Open full list** link; no AI |

The **Open full list** link navigates to `/shopping-list?plan=<id>` with the correct plan id so review, edit, confirm, and in-store use happen on the canonical page.

The modal fetches the saved consolidated list lines via `GET /api/v1/saved-weekplans/:id/consolidated-shopping-list` only for the **Ready** state. It reads the two status flags from the parent (already available from issue 0001 list-row data) to decide which state to render before making any extra fetch.

The **Consolidated shopping list copy notice** (issue 0006) is shown inside the modal on first open after copy-on-match.

Component location: `app/components/shopping-list/ConsolidatedShoppingListPreview.vue`.

## Acceptance criteria

- [ ] Modal renders aisle-grouped lines (via `ShoppingListAisleSection` with `readonly`) in **Ready** state.
- [ ] Modal renders outdated warning + **Open full list** in **Outdated** state without fetching or running AI.
- [ ] Modal renders empty-state + **Open full list** in **No list yet** state.
- [ ] **Open full list** navigates to `/shopping-list?plan=<id>`.
- [ ] No consolidation API call is made from within the modal under any state.
- [ ] Copy notice (issue 0006) is shown when applicable.
- [ ] Collapse state of aisle sections is not preserved across modal opens (all expanded on each open).
- [ ] Component tests: ready state renders lines, outdated state renders warning without API call, no-list state renders empty-state, open-full-list navigates correctly.

## Blocked by

- [0001 — List-row shopping flags on Weekplan collection API](./0001-list-row-shopping-flags.md)
- [0007 — Aisle section UI component](./0007-aisle-section-ui-component.md)
