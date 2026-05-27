# 0002 — Weekplan consolidated list status badge component

## Parent

[PRD: Auto-consolidated shopping list redesign](../prd/auto-consolidated-shopping-list-redesign.md) — [ADR 0004](../../docs/adr/0004-auto-consolidated-shopping-list-redesign.md)

## What to build

Build a `WeekplanConsolidatedListStatus` presentational component that maps the two plan flags to one of three visible states: **List ready**, **List outdated**, or **No list yet**. Wire it into the manage-plans page (`app/pages/saved-weekplans.vue`) on each plan card, and into the weekly planner (`app/pages/weekly-plan.vue` / relevant child component) when a **Saved Weekplan** is open.

The component receives `hasSavedShoppingList: boolean` and `shoppingListDeprecated: boolean` as props; it has no API calls of its own. The managing parent feeds the flags from the enriched list-row data added in issue 0001.

Component location: `app/components/shopping-list/WeekplanConsolidatedListStatus.vue`.

## Acceptance criteria

- [ ] `WeekplanConsolidatedListStatus` renders "List ready" when `hasSavedShoppingList && !shoppingListDeprecated`.
- [ ] Renders "List outdated" when `hasSavedShoppingList && shoppingListDeprecated`.
- [ ] Renders "No list yet" when `!hasSavedShoppingList`.
- [ ] Badge is visible on each plan card in the manage-plans page (`app/pages/saved-weekplans.vue`), fed from the enriched list response.
- [ ] Badge is visible in the weekly planner when a Saved Weekplan is loaded, fed from the same flags.
- [ ] Component and integration tests cover all three states for both entry points.
- [ ] No API calls inside the component.

## Blocked by

- [0001 — List-row shopping flags on Weekplan collection API](./0001-list-row-shopping-flags.md)
