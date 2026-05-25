# Round scaled ingredient quantities for display

**Source:** REV-005 (Low) — branch review 2026-05-25
**Type:** AFK

## What to build

Round scaled ingredient quantities before display to avoid floating-point noise (e.g. `0.30000000000000004`). Apply rounding in `buildShoppingList` or `formatShoppingListIngredient` in `utils/shoppingList.ts` — at most 2 decimal places, dropping trailing zeros for whole numbers (e.g. `1.50` → `1.5`, `2.00` → `2`).

## Acceptance criteria

- [ ] Scaled quantities with floating-point noise are rounded to at most 2 decimal places
- [ ] Whole-number quantities display without a decimal suffix (`2`, not `2.00`)
- [ ] Unit tests cover: integer quantity, non-integer quantity, quantity that produces FP noise (e.g. `0.1 * 3 = 0.30000000000000004`), multi-occurrence scaling

## Blocked by

None — can start immediately.
