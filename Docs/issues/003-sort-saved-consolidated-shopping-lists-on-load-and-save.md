# Sort saved consolidated shopping lists on load and save

Type: AFK
Labels: needs-triage
Source: `Docs/prd/shopping-list-store-walk-order.md`

## What to build

Make **Saved consolidated shopping list** records participate in **Shopping list store walk order** without changing the persistence schema, so older unsorted records become usable on load and newly confirmed records stay sorted after save.

## Acceptance criteria

- [ ] Loading a valid **Saved consolidated shopping list** returns or displays its `lines` sorted by **Shopping list store walk order** without requiring re-consolidation.
- [ ] Older saved records with unsorted line arrays are re-ordered on load while preserving ingredient names, quantities, units, and line IDs.
- [ ] Saving a confirmed consolidated list stores and returns sorted lines, or immediately sorts the returned record before assigning it to display state.
- [ ] Deprecated saved lists keep existing deprecation behavior and are not silently overwritten by sorting.
- [ ] No saved-list database schema changes are introduced.
- [ ] Unit tests cover saved-list load, older unsorted records, save/confirm behavior, and stable repeated refresh order.

## Blocked by

- `Docs/issues/001-teach-store-walk-order-about-spices-and-sauces.md`
