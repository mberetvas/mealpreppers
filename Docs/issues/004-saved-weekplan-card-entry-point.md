# 004 — Shopping List: Saved Weekplan card entry point

## What to build

Add a shopping list entry point to each Saved Weekplan card on `/saved-weekplans`.

In the card actions row (which already contains Rename, Delete, and Open), add a `shopping_cart` icon `NuxtLink` that navigates to `/shopping-list?plan=<id>`. Place it between the Rename and Delete icon buttons, before the primary "Open" button.

The link must carry an accessible `aria-label` that includes the plan name (e.g. "Shopping list for Summer week").

No new script logic or state is required — this is a template-only change.

## Design reference

Take inspiration from `stitch/shoppingListGenerator/shoppinglist.html` for icon sizing and colour tokens to stay consistent with the shopping list page.

## Acceptance criteria

- [ ] Each Saved Weekplan card on `/saved-weekplans` renders a shopping cart icon button.
- [ ] Clicking the button navigates to `/shopping-list?plan=<id>` for the correct plan.
- [ ] The button has `aria-label="Shopping list for {plan name}"`.
- [ ] The icon uses Material Symbols `shopping_cart`.
- [ ] The button is visually consistent with the existing Rename and Delete icon buttons (same sizing, hover styles).
- [ ] Keyboard users can reach and activate the button in the natural tab order.
- [ ] The empty-state view (no Saved Weekplans) is unaffected.

## Blocked by

- #002 — Shopping List: page happy path
