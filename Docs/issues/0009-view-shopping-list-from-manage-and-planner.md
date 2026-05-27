# 0009 — View shopping list from manage plans & planner

## Parent

[PRD: Auto-consolidated shopping list redesign](../prd/auto-consolidated-shopping-list-redesign.md) — [ADR 0004](../../docs/adr/0004-auto-consolidated-shopping-list-redesign.md)

## What to build

Wire a **View shopping list** action into the manage-plans page (`app/pages/saved-weekplans.vue`) and the weekly planner (`app/pages/weekly-plan.vue` / relevant child) so users can open `ConsolidatedShoppingListPreview` (issue 0008) inline without navigating away.

Both entry points already have a shopping-cart link that goes straight to the full `/shopping-list?plan=id` page. This slice adds a **View shopping list** affordance (e.g. button or icon alongside the existing cart link) that opens the preview modal instead. The existing full-page link remains available (and is also reachable via **Open full list** inside the modal).

The action must be visible regardless of list status — even when **No list yet** — so the entry point is never hidden (story 28). Status context is supplied by the flag data from issue 0001 (already rendered by issue 0002 badges).

## Acceptance criteria

- [ ] **View shopping list** action is present on every plan card in `saved-weekplans.vue`, regardless of list status.
- [ ] **View shopping list** action is present in the weekly planner when a Saved Weekplan is loaded.
- [ ] Clicking **View shopping list** opens `ConsolidatedShoppingListPreview` for the correct plan.
- [ ] The existing direct link to the full shopping-list page (`/shopping-list?plan=id`) is not removed.
- [ ] Preview modal shows the correct state (ready / outdated / no list yet) matching the plan's flags.
- [ ] Component tests: action present on manage cards, action present in planner, modal opens for correct plan, all three modal states reachable from both entry points.

## Blocked by

- [0008 — Consolidated shopping list preview modal](./0008-consolidated-shopping-list-preview-modal.md)
