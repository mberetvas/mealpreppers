# 003 — Shopping List: resilience states

## What to build

Extend `app/pages/shopping-list.vue` with the four resilience states that were excluded from the happy-path slice:

1. **Plan error / missing ID** — if the `plan` query param is absent, or `GET /api/v1/saved-weekplans/:id` returns any error, render an error card ("Plan could not be loaded") with a "Back to Manage plans" link to `/saved-weekplans`.

2. **Partial-load warning** — if one or more individual recipe fetches fail (via `Promise.allSettled`), render a non-blocking `role="status"` banner: "N recipe(s) could not be loaded — this list may be incomplete." Successfully loaded recipes still render.

3. **Missing plan ID** — `/shopping-list` with no `plan` query param renders the same error card as the plan-error state.

4. **Refresh re-fetches** — the Refresh button (added in #002) resets all error/warning state and re-runs the full fetch cycle from scratch, including re-checking for partial failures.

## Design reference

Take inspiration from `stitch/shoppingListGenerator/shoppinglist.html` for surface colours, card styling, and typography tokens when designing the error and warning states.

## Acceptance criteria

- [ ] Navigating to `/shopping-list` with no `plan` query param renders the error card with a back-link to `/saved-weekplans`.
- [ ] When `GET /api/v1/saved-weekplans/:id` returns a non-2xx response, the error card renders and no recipe sections are shown.
- [ ] When one recipe fetch fails and others succeed, the partial-load warning banner appears with the correct count, and all successfully loaded recipe sections still render.
- [ ] When all recipe fetches fail, the partial-load warning banner shows the total count; the section list is empty but no crash occurs.
- [ ] Clicking Refresh after a partial failure re-triggers all fetches; if all succeed on retry, the warning banner disappears.
- [ ] The partial-load warning uses `role="status"` and `aria-live="polite"` semantics.
- [ ] The error card does not appear alongside a partial-load warning — they are mutually exclusive states.

## Blocked by

- #002 — Shopping List: page happy path
