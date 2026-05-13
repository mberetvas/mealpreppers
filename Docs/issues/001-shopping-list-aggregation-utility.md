# 001 — Shopping List: aggregation utility

## What to build

Add a pure, framework-free utility module (`utils/shoppingList.ts`) that encapsulates all Shopping List aggregation logic, and cover it with unit tests (`test/unit/shopping-list.test.ts`).

The module exposes two functions and two types:

- `collectRecipeOccurrences(plan: WeekPlanV1): Map<string, number>` — iterates all 21 meal slots in day-ascending, breakfast→lunch→dinner order; skips null slots; returns an insertion-ordered map of `recipeId → occurrenceCount`.
- `buildShoppingList(occurrences: Map<string, number>, recipes: Map<string, RecipeCatalogItem>): ShoppingListSection[]` — for each entry in `occurrences` (preserving order): looks up the recipe (skips if absent), multiplies each ingredient's `quantity` by the occurrence count (if `quantity` is undefined, leaves it undefined and uses `rawText` as-is), returns one `ShoppingListSection` per unique recipe.
- `ShoppingListIngredient` — `{ rawText: string; name: string; quantity: number | undefined; unit: string | undefined }`
- `ShoppingListSection` — `{ recipeId: string; recipeTitle: string; occurrenceCount: number; ingredients: ShoppingListIngredient[] }`

Model the module after `utils/weekPlan.ts`: pure functions, typed inputs/outputs, no `~/` or Nuxt auto-imports.

## Acceptance criteria

- [ ] `collectRecipeOccurrences` returns an empty map for an empty weekplan.
- [ ] `collectRecipeOccurrences` returns count 1 for a recipe appearing once.
- [ ] `collectRecipeOccurrences` returns count 2 for a recipe appearing in two slots.
- [ ] `collectRecipeOccurrences` skips null slots silently.
- [ ] `collectRecipeOccurrences` preserves insertion order (day ascending, breakfast before lunch before dinner).
- [ ] `buildShoppingList` multiplies `quantity` by `occurrenceCount` for ingredients that have a quantity.
- [ ] `buildShoppingList` leaves `quantity` undefined and preserves `rawText` unchanged for ingredients without a quantity.
- [ ] `buildShoppingList` omits a section entirely if the recipe is not present in the `recipes` map.
- [ ] `buildShoppingList` produces an empty `ingredients` array for a recipe with no ingredients.
- [ ] `buildShoppingList` output order matches the insertion order of `occurrences`.
- [ ] All unit tests in `test/unit/shopping-list.test.ts` pass with `bun run test`.
- [ ] No Nuxt, Vue, or `~/` imports in `utils/shoppingList.ts`.

## Blocked by

None — can start immediately.
