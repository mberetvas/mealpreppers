# Teach store walk order about spices and sauces

Type: AFK
Labels: needs-triage
Source: `Docs/prd/shopping-list-store-walk-order.md`

## What to build

Extend the existing **Shopping list store walk order** deep module so consolidated lines classify and sort dried spices, seasonings, sauces, and pastes into the intended supermarket sequence while preserving fresh herbs as produce and unknown ingredients as other.

## Acceptance criteria

- [ ] **Shopping list store walk order** includes a distinct **Shopping list spice area** after dry goods and before canned/sauces.
- [ ] Dried spices and seasonings such as `paprikapoeder` and `kerriepoeder` classify into the spice area.
- [ ] Fresh herbs such as `peterselie` and `basilicum` continue to classify as produce.
- [ ] Sauces and pastes such as `tomatenpuree` and `pesto` classify into the **Shopping list sauce area (walk order)** / canned-sauces step.
- [ ] Unknown ingredients continue to sort at the end as other.
- [ ] Sorting within each store area uses Dutch-locale alphabetical ordering, remains stable for equal sort keys, and does not mutate line identity, name, quantity, or unit.
- [ ] Unit tests cover the updated area sequence and representative names from the PRD: `appelazijn`, `bloemkool`, `gember`, `knoflook`, `paprikapoeder`, `peterselie`, `rode appel`, `rode paprika`, `tomatenblokjes`, and `tomatenpuree`.

## Blocked by

None - can start immediately
