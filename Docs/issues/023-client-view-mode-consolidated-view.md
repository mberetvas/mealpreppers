# Client view mode toggle + consolidated view

**Label:** `needs-triage`

## Parent

[PRD — Shopping list AI consolidation](../prd/shopping-list-ai-consolidation.md)

## What to build

Client-side shopping list changes: **Shopping list view mode** toggle, **Consolidated shopping list** rendering, **Consolidate action**, and all associated loading/error/fallback/retry states. This is the first user-visible consolidation experience.

**View mode toggle:**
- Add an in-page control to switch between **Recipe sections view** (default) and **Consolidated shopping list**.
- Sync mode to URL: `view=consolidated` when consolidated; omitted for recipe sections. Refresh and shared links preserve mode.
- Switching mode alone does not call the consolidation API.
- Show guidance on first consolidated view open that consolidation requires an explicit action.

**Consolidate action:**
- Explicit button in consolidated view triggers `POST /api/v1/saved-weekplans/:id/consolidate-shopping-list`.
- Loading feedback while the API call runs.
- On success: render `consolidatedLines` from response.
- On error / `baseline_fallback`: show fallback banner with baseline lines and retry option.
- On `ai_skipped`: show baseline with warning that AI was unavailable.
- Consolidated results stay available while the user remains on the page in consolidated mode (session-scoped).
- Each new consolidate action refreshes from current plan data.

**Recipe sections parity:**
- User can return to **Recipe sections view** at any time.
- Occurrence badges in recipe sections are unchanged by consolidation work.
- Page refresh in recipe sections view reloads plan and recipes as before.

## Acceptance criteria

- [ ] View mode toggle switches between recipe sections and consolidated view
- [ ] URL reflects `view=consolidated` when in consolidated mode; omitted otherwise
- [ ] Refresh on `view=consolidated` URL restores consolidated view (without auto-calling API)
- [ ] Guidance text shown when consolidated view has no results yet
- [ ] Consolidate button triggers API call; loading indicator shown during request
- [ ] Successful consolidation renders `consolidatedLines`
- [ ] `baseline_fallback` / `ai_skipped` shows baseline lines + appropriate warning + retry
- [ ] Error response shows error message + retry option
- [ ] Consolidated results persist in session while on page; cleared on full page reload
- [ ] Return to recipe sections view works without data loss
- [ ] Occurrence badges unchanged in recipe sections view
- [ ] Tests: component tests for view mode states, URL sync, loading, error, fallback, retry, return to sections

## Blocked by

- [021 — Consolidation API with baseline fallback](./021-consolidation-api-baseline-fallback.md)
