# PRD: Shopping List Generator

## Problem Statement

Users create and save Weekplans in the Weekly Atelier, but there is no way to turn a Saved Weekplan into an actionable shopping list. They must manually look at each day's recipes, cross-reference ingredient lists, and compile a shopping list by hand. This is tedious and error-prone, especially when the same recipe appears multiple times in a week and quantities need to be multiplied.

## Solution

Add a Shopping List page that computes an aggregated ingredient list from any Saved Weekplan on demand. The list is grouped by recipe and quantities are multiplied by the number of times the recipe appears in the plan. The page is accessible from a new action on each Saved Weekplan card and from a dismissible banner shown immediately after a draft is first saved in the Weekly Atelier.

## User Stories

1. As a meal prepper, I want to navigate to a shopping list for any of my Saved Weekplans, so that I can see all the ingredients I need to buy in one place.
2. As a meal prepper, I want to access the shopping list from the Manage Plans page, so that I can generate a list for any plan without going back to the planner.
3. As a meal prepper, I want to be prompted to view the shopping list immediately after I save a draft weekplan, so that I can act on it while the plan is fresh in my mind.
4. As a meal prepper, I want the shopping list to be grouped by recipe, so that I understand where each ingredient comes from.
5. As a meal prepper, I want ingredient quantities to be multiplied when the same recipe appears more than once in the week, so that the quantities reflect what I actually need.
6. As a meal prepper, I want empty meal slots to be silently ignored, so that my shopping list only shows meals I have actually planned.
7. As a meal prepper, I want to be warned if a recipe could not be loaded, so that I know my shopping list may be incomplete rather than assuming it is correct.
8. As a meal prepper, I want to see a fresh shopping list every time I open the page, so that any edits I made to the weekplan are automatically reflected.
9. As a meal prepper, I want a manual Refresh button on the shopping list page, so that I can re-fetch the latest data if I have made changes while keeping the page open in another tab.
10. As a meal prepper, I want the shopping list page to show me which Saved Weekplan it belongs to, so that I can confirm I am viewing the right plan.
11. As a meal prepper, I want to navigate back to the Saved Weekplan from the shopping list, so that I can make changes and return to update the list.
12. As a meal prepper, I want the shopping list to show the recipe's name as a section header, so that I can quickly scan which recipes contribute ingredients.
13. As a meal prepper, I want to see the occurrence count next to each recipe section (e.g. "× 2"), so that I know how many times that recipe appears in the plan.
14. As a meal prepper, I want each ingredient line to show quantity, unit, and name, so that I know exactly how much of each item to buy.
15. As a meal prepper, I want ingredients with no quantity or unit to still appear in the list using their raw text, so that no ingredient is silently lost.
16. As a mobile user, I want the shopping list to be easy to read and scroll on a small screen, so that I can use it while walking around a supermarket.
17. As a user who is not signed in, I want the shopping list to still work for my anonymous session's Saved Weekplans, so that I do not need an account to use this feature.
18. As a meal prepper, I want the page to show a loading state while the weekplan and recipes are being fetched, so that I know data is on its way.
19. As a meal prepper, I want a clear error state if the Saved Weekplan itself cannot be loaded (e.g. it was deleted), so that I am not left looking at a blank page.
20. As a meal prepper, I want the dismissible banner in the planner to be unobtrusive and easy to dismiss, so that it does not interrupt me if I want to keep editing.

## Implementation Decisions

### Modules to build or modify

**Shopping List page (`/shopping-list?plan=<id>`)** — New page. Fetches the Saved Weekplan by ID, extracts unique recipe IDs, fans out to fetch each recipe in parallel, then aggregates ingredients grouped by recipe with quantities multiplied by occurrence count. Renders a loading state, an error state (plan not found), a partial-load warning (one or more recipes could not be fetched), and the aggregated ingredient list. Includes a manual Refresh action that re-triggers the full fetch cycle. Has no server-side persistence of its own.

**Shopping List aggregation logic** — A pure utility function (no side effects, no framework dependency) that accepts a list of recipe-with-occurrences pairs and returns an ordered list of recipe sections, each with a multiplied ingredient list. This is the deep module: it encapsulates all aggregation rules and is independently testable without mounting a component or hitting any API.

**Saved Weekplan card (`/saved-weekplans`)** — Modified to add a "Shopping list" icon button alongside the existing Rename, Delete, and Open actions. The button navigates to `/shopping-list?plan=<id>`.

**Weekly Atelier save flow (`/weekly-plan`)** — Modified to show a dismissible banner after `persistDraftAsSavedWeekplan()` succeeds. The banner contains a link to `/shopping-list?plan=<created.id>` and can be dismissed by the user. It does not block further editing.

### Data flow

- Route: `/shopping-list?plan=<id>` — the plan ID is a query parameter, matching the existing `?template=<id>` convention used by the planner.
- No new API endpoints. The page uses `GET /api/v1/saved-weekplans/:id` and `GET /api/v1/recipes/:id` (existing endpoints).
- Recipe fetches are fired in parallel via `Promise.all` after the weekplan is loaded. Only unique recipe IDs are fetched (deduplication before fan-out).
- `null` slots in the `WeekPlanV1` body are skipped before deduplication.
- If any individual recipe fetch fails (e.g. 404), it is counted and a non-blocking warning banner is shown; successfully loaded recipes still contribute to the list.
- The page fetches fresh on every mount. No polling. A manual Refresh button re-runs the same fetch cycle.

### Aggregation rules

- Count occurrences per unique recipe ID across all 21 meal slots (7 days × 3 meals).
- For each unique recipe: multiply each ingredient's `quantity` by the occurrence count. If `quantity` is absent, display `rawText` as-is without multiplication.
- Group the output by recipe, ordered by the recipe's first appearance in the weekplan (day ascending, then breakfast → lunch → dinner).

### Navigation

- The Saved Weekplan card gets a shopping cart icon button (Material Symbols: `shopping_cart`) that navigates to `/shopping-list?plan=<id>`.
- The post-save banner in the planner links to `/shopping-list?plan=<id>` and has a dismiss (×) button.
- The shopping list page has a back-link or breadcrumb to `/saved-weekplans`.

## Testing Decisions

A good test exercises only the observable output of a module given a specific input — it does not assert on intermediate state, internal variable names, or rendering implementation details.

**Shopping List aggregation utility** — Unit tested. Given a list of `{ recipe, occurrenceCount }` pairs, assert the correct grouped output: correct section order, correct multiplied quantities, correct raw-text fallback when quantity is absent, correct handling of zero-ingredient recipes.

**Shopping list page** — Component or integration tested. Mount the page with a mocked `plan` query param. Stub `$fetch` to return a known weekplan and a set of recipes. Assert: correct recipe sections appear, quantities are multiplied, a warning banner appears when one recipe fetch fails, the Refresh button triggers a re-fetch, and a "plan not found" error state appears when the weekplan fetch returns 404.

Prior art: see existing component tests under `test/component/` and unit tests under `test/unit/` for patterns on stubbing `$fetch` and mounting Nuxt pages.

## Out of Scope

- Persisting the shopping list to the database as a snapshot.
- Automatic real-time refresh via polling or websockets when the linked weekplan changes.
- Cross-recipe ingredient deduplication (e.g. combining "200g onion" from two different recipes into "400g onion"). This is a future enhancement.
- Checking/unchecking individual ingredients (stateful shopping mode).
- Printing or exporting the shopping list (PDF, share sheet).
- Shopping list support for Month Plans.
- Sorting or filtering ingredients by category or aisle.

## Further Notes

- The `WeekPlanV1` type stores only `recipeId` per slot; all ingredient data comes from the recipe catalog. The shopping list is therefore always as up-to-date as the recipe catalog, with no sync problem.
- Anonymous session users are supported because the existing `GET /api/v1/saved-weekplans/:id` endpoint already scopes access to the current Planning Principal (authenticated or anonymous).
- The post-save banner in the planner should only appear once per save action — it must not re-appear on subsequent autosaves or PATCH updates to the same Saved Weekplan.
