# 002 — Shopping List: page happy path

## What to build

Implement `app/pages/shopping-list.vue` end-to-end for the main success flow.

On mount the page reads the `plan` query parameter, fetches `GET /api/v1/saved-weekplans/:id`, calls `collectRecipeOccurrences` on the returned `WeekPlanV1` body, fans out in parallel via `Promise.allSettled` to `GET /api/v1/recipes/:id` for each unique recipe ID, builds the aggregated Shopping List with `buildShoppingList`, and renders it.

The template covers:
- Loading state: pulse-skeleton cards with `aria-busy="true"`.
- Header: `<h1>` with plan name, subtitle "Shopping list", back-link to `/saved-weekplans`, Refresh icon button (`refresh` Material Symbol) that re-runs the full fetch cycle (disabled while loading).
- Sections `<ul>`: one section per unique recipe in first-appearance order. Section header `<h2>` shows recipe title and a `× N` badge when `occurrenceCount > 1`. Ingredient `<ul>` shows `{quantity} {unit} {name}` or `rawText` fallback per line.
- Empty state: plan loaded but zero assigned recipe slots — "This plan has no recipes yet" with a link to open the plan in the planner (`/weekly-plan?template=<id>`).
- Page title via `useHead`: `Shopping list — {planName}` when name is known, `Shopping list` otherwise.

No new API endpoints. Uses existing `GET /api/v1/saved-weekplans/:id` and `GET /api/v1/recipes/:id`.

## Design reference

Take inspiration from `stitch/shoppingListGenerator/shoppinglist.html` for layout, typography, colour tokens, and interaction patterns (checkbox strike-through, `× N` badge styling, recipe section cards, header hierarchy).

## Acceptance criteria

- [ ] Navigating to `/shopping-list?plan=<id>` with a valid Saved Weekplan renders recipe sections with correct ingredient lines.
- [ ] Quantities are multiplied by the recipe occurrence count (e.g. pasta twice → 2× ingredient quantities).
- [ ] Ingredients without a `quantity` render their `rawText` unchanged.
- [ ] Each recipe section shows `× N` only when `occurrenceCount > 1`.
- [ ] Sections appear in the order of the recipe's first appearance in the plan (day ascending, breakfast → lunch → dinner).
- [ ] Null meal slots are silently skipped and do not appear in the list.
- [ ] The loading skeleton renders while data is in flight.
- [ ] The plan name appears in the page `<h1>` and in the document `<title>`.
- [ ] The back-link navigates to `/saved-weekplans`.
- [ ] The Refresh button re-fetches and re-renders the list; it is disabled while loading.
- [ ] A weekplan with no assigned recipe slots shows the empty state copy and a link to the planner.
- [ ] Anonymous session users can view the Shopping List for their plans.
- [ ] The layout is usable on a 375px mobile viewport.

## Blocked by

- #001 — Shopping List: aggregation utility
