# Extract `useShoppingList` composable with race guard

**Source:** REV-001 (High), REV-003 (Medium) — branch review 2026-05-25
**Type:** AFK

## What to build

Extract the fetch-and-build orchestration from `app/pages/shopping-list.vue` into a `useShoppingList(planId)` composable. The composable must include a load-generation token — capture `planId.value` before each async boundary and discard any response where the token no longer matches the current `planId` — so that concurrent loads triggered by rapid `?plan=` changes cannot render a stale plan's sections after the URL has moved on. Behavioral tests for the composable replace the current source-regex assertions for plan-link change and total-failure states.

## Acceptance criteria

- [ ] `useShoppingList(planId)` composable exists and owns all fetch, build, and state management for the Shopping list
- [ ] Load-generation token prevents a stale `?plan=` response from being applied (test: two concurrent loads where the first resolves after the second — only the second result is applied)
- [ ] `app/pages/shopping-list.vue` delegates fully to the composable; no orchestration logic remains inline on the page
- [ ] Behavioral unit tests cover: plan loaded successfully, plan-link change mid-load (first result discarded), total recipe-resolution failure, partial recipe-resolution failure
- [ ] No source-regex assertions for watch or failure behaviour remain in the test suite

## Blocked by

None — can start immediately.
