# Branch review: improve-architecture vs main

## Executive summary

Saved Weekplans consolidation is **architecturally sound and ready to merge** for its core goal: week-grid CRUD is principal-scoped via `savedWeekplansRepository`, legacy `/api/v1/planning/week-templates` routes are removed, and the client (planner, hydration, autosave, shopping list) uses `/api/v1/saved-weekplans` only. **Highest-risk finding:** the shopping list page has **no in-flight load guard**, so fast SPA changes to `?plan=` can show another plan’s ingredients after the URL has changed. Prior review items for plan-link reload, access comments, and total recipe-resolution UI are **fixed in current code**. Unit tests for this branch pass; full `bun test` fails on component/DOM setup unrelated to the diff.

## Findings

### Critical

_None._

### High

- **ID:** REV-001
- **Area:** Shopping list (`shopping-list.vue`)
- **Issue:** Concurrent `load()` calls on rapid `?plan=` changes can finish out of order and render the wrong plan’s sections while the route shows a different id.
- **Evidence:** `app/pages/shopping-list.vue:26-73` — `watch(planId, load)` and `onMounted(load)` with no request generation token, `AbortController`, or “ignore stale response” check before assigning `sections` / `planName`.
- **Impact:** User sees incorrect shopping list data (wrong recipes/quantities) after in-app navigation between Saved Weekplans; hard to notice without comparing to the header title.
- **Suggestion:** Capture `const loadId = planId.value` at start; only apply results when `loadId === planId.value` at each await boundary, or abort prior fetches.

### Medium

- **ID:** REV-002
- **Area:** Weekly planner / post-save nudge (`weekly-plan.vue`)
- **Issue:** Post-save shopping-list nudge is not cleared when loading another Saved Weekplan from the template library or route hydration.
- **Evidence:** `shoppingListNudgeId` is set at `app/pages/weekly-plan.vue:398` and cleared only on dismiss (`556`), `onBeforeUnmount` (`225`), or new save — not in `loadTemplateIntoWeek` (`308-325`) or `hydrateTemplateFromRoute` (`197-213`). Prior `review.md` claimed template-switch clearing; that was **not** re-verified correctly (only unmount clears).
- **Impact:** “View shopping list” can link to a previously saved plan after the user switched to a different week grid.
- **Suggestion:** Set `shoppingListNudgeId.value = null` at the start of `loadTemplateIntoWeek` and successful `hydrateTemplateFromRoute`; add a source-level test like issue 003/006 patterns.

- **ID:** REV-003
- **Area:** Shopping list tests / page adapter
- **Issue:** Fetch-and-build orchestration is duplicated between the page and `test/unit/shopping-list-page.test.ts` (`loadShoppingList` mirror); SPA reload and total-failure UI are asserted via **source regex**, not shared runtime logic.
- **Evidence:** `test/unit/shopping-list-page.test.ts:11-40` vs `app/pages/shopping-list.vue:26-73`; issue 006/007 tests at `282-327` read `shopping-list.vue` as text only.
- **Impact:** Page and test pipeline can drift (e.g. race guard added in page but not mirror); regex tests pass while behavior regresses.
- **Suggestion:** Extract `useShoppingList(planId)` (or `loadShoppingListForPlan`) used by page and unit tests; behavioral tests for plan-link change and total-failure states.

- **ID:** REV-004
- **Area:** Recipe catalog / shopping list security assumption
- **Issue:** Shopping list resolves recipes via unscoped `GET /api/v1/recipes/:id` with no principal check on the handler.
- **Evidence:** `server/api/v1/recipes/[id].get.ts:14-18` calls `getRecipeById` without auth; `app/pages/shopping-list.vue:46-48` fans out per id after principal-scoped plan fetch.
- **Impact:** Acceptable while all catalog recipes are public; if private recipes are added later, knowing ids from a permitted plan could leak catalog rows cross-principal.
- **Suggestion:** Document public-catalog assumption in CONTEXT or ADR; future batch endpoint should enforce same visibility as the plan principal.

### Low

- **ID:** REV-005
- **Area:** `utils/shoppingList.ts`
- **Issue:** Scaled quantities use raw floating-point multiply without display rounding.
- **Evidence:** `utils/shoppingList.ts:60` — `ing.quantity * occurrenceCount`; `formatShoppingListIngredient` joins numeric quantity as-is (`69-76`).
- **Impact:** UI may show values like `0.30000000000000004` for non-integer ingredient quantities.
- **Suggestion:** Round for display (e.g. 2 decimal places) in `buildShoppingList` or formatter.

- **ID:** REV-006
- **Area:** Documentation (`Docs/audits/001-legacy-unowned-week-grid-rows.md`)
- **Issue:** Audit doc still states `legacy_unowned` rows are “visible only via deprecated” week-templates routes after those routes were removed on this branch.
- **Evidence:** `Docs/audits/001-legacy-unowned-week-grid-rows.md:5` vs deleted `server/api/v1/planning/week-templates/*` and ADR 0001.
- **Impact:** Ops runbook misleads operators about recovery paths (rows are unreachable via product API until backfill/purge).
- **Suggestion:** Update to “hidden from Saved Weekplans API (404); recover only via SQL scripts.”

- **ID:** REV-007
- **Area:** Planning hydration naming
- **Issue:** `fetchWeekTemplateRowForPlanner` retains “template” naming while exclusively calling Saved Weekplans (terminology drift vs CONTEXT.md).
- **Evidence:** `utils/planningHydration.ts:11-22`; CONTEXT.md Saved Weekplan vocabulary lines 55-78.
- **Impact:** Maintainability / onboarding confusion only.
- **Suggestion:** Rename to `fetchSavedWeekplanForPlanner` when touching hydration next.

- **ID:** REV-008
- **Area:** Shopping list UX
- **Issue:** Missing `?plan=` uses the same error panel as failed/forbidden plan fetch.
- **Evidence:** `app/pages/shopping-list.vue:33-36`, `127-147` — single `planError` branch.
- **Impact:** Users cannot distinguish “no plan selected” from access failure without reading copy.
- **Suggestion:** Branch on empty `planId` with link to `/saved-weekplans`.

- **ID:** REV-009
- **Area:** Shopping list UX (total failure)
- **Issue:** Total recipe-resolution failure still shows partial-failure copy (“this list may be incomplete”) above a dedicated empty state.
- **Evidence:** `app/pages/shopping-list.vue:173-182` — warning uses same string as partial-load banner (`210-217`).
- **Impact:** Minor copy confusion when zero recipes loaded.
- **Suggestion:** Use total-failure-specific banner text when `sections.length === 0`.

- **ID:** REV-010
- **Area:** Ops / agent tooling
- **Issue:** `scripts/code-review.ps1` and `Docs/ralph-loop/cursor-ralph-loop.ps1` invoke Cursor Agent with `--force` (and ralph loop adds `--trust`, `--approve-mcps`), allowing unsupervised file and MCP changes.
- **Evidence:** `scripts/code-review.ps1:6`, `235`; `Docs/ralph-loop/cursor-ralph-loop.ps1:305-307`.
- **Impact:** Misuse on shared machines or production-adjacent envs could modify repo or approve MCP actions without human review.
- **Suggestion:** Document trusted-local-only usage; optional `-ReadOnly` / drop `--force` for review-only runs.

- **ID:** REV-011
- **Area:** Ops / audit script
- **Issue:** `scripts/audit-legacy-unowned-week-templates.ts` requires service-role credentials without an in-script environment guard beyond env vars.
- **Evidence:** `scripts/audit-legacy-unowned-week-templates.ts:4-21` — uses `SUPABASE_SERVICE_ROLE_KEY`; header comment notes service role but no `MEALPREPPERS_ENV` gate.
- **Impact:** Accidental run against production if `.env` points at prod (operator error).
- **Suggestion:** Require explicit `MEALPREPPERS_ENV` and confirm non-local in interactive prompt or documented checklist (audit doc table already expects HITL).

- **ID:** REV-012
- **Area:** SQL migration (`supabase/scripts/purge-legacy-unowned-week-templates.sql`)
- **Issue:** Purge script is destructive and not idempotent in the sense of “safe to re-run” beyond SQL semantics (re-run on empty set is fine; run before audit is dangerous).
- **Evidence:** `supabase/scripts/purge-legacy-unowned-week-templates.sql:7-11` — unconditional `DELETE` with runbook in `Docs/audits/001-legacy-unowned-week-grid-rows.md`.
- **Impact:** Data loss if executed before HITL count/decision.
- **Suggestion:** Already documented; enforce “audit first” in ops checklist (no code change required if process followed).

## Verified fixes (from prior review.md)

- **SPA `?plan=` reload:** `watch(planId, load)` present at `app/pages/shopping-list.vue:72` (issue 006).
- **`savedWeekplanAccess` stale comment:** Updated at `server/services/planning/savedWeekplanAccess.ts:16-19` to 404 + audit doc reference (issue 008).
- **Total recipe-resolution failure UI:** Dedicated branch at `app/pages/shopping-list.vue:172-204` with heading “Could not load recipes for this plan” (issue 007).
- **Legacy week-templates API removal:** Routes deleted; client uses `/api/v1/saved-weekplans` (`weekly-plan.vue`, `planningHydration.ts`, autosave composable); guarded by `saved-weekplans-single-persistence-adr.test.ts` and repository tests.
- **Principal scoping on Saved Weekplans:** `interpretSavedWeekplanAccess` → 404 for `legacy_unowned`, 403 for wrong owner (`savedWeekplansRepository.ts`, unit tests).
- **Incorrect prior claim:** Post-save nudge cleared on template switch — **not fixed** (see REV-002).

## Architecture notes (optional, max 5)

- **Race + duplication (REV-001, REV-003):** A single `useShoppingList` module at the page seam fixes locality and gives one place for generation-token logic (Depth ↑, duplicate orchestration ↓).
- **Slot traversal:** `collectRecipeOccurrences` and `collectRecipeIdsFromWeekPlan` still duplicate 21-slot walks — only a maintainability risk if ordering rules diverge; not a current correctness defect.
- **ADR 0001 alignment:** No second week-grid repository path on `meal_week_templates` for product features; `planningRepository` correctly limited to month plans + recipe-id helpers.
- **Shallow tests for UI contracts:** Source-regex tests for watch/total-failure prove intent but do not substitute for composable-level behavioral tests (test gap tied to REV-003).

## Test plan

- [x] `git diff main...HEAD --stat` — 46 files, +2077 / −972 (Saved Weekplans, shopping list, audit tooling, docs, scripts).
- [x] Read product diff: `server/`, `app/`, `utils/`, `test/`, `supabase/scripts/`, planning services.
- [x] Read `CONTEXT.md` and `docs/adr/0001-saved-weekplans-single-persistence.md` — consistent; minor drift in audit doc and `fetchWeekTemplateRowForPlanner` name.
- [x] `bun test` — **321 pass, 55 fail, 5 errors** (failures: `document is not defined` in component tests, Vue Test Utils `WeakMap` in component mounts, Nuxt/logging integration — environment/project config, not branch slice failures).
- [x] `bun run test:unit` — **362 pass, 0 fail** (all branch unit tests included).
- [x] Scoped branch unit tests (7 files) — **52 pass, 0 fail** (shopping list, saved weekplans repository, hydration, autosave, ADR guard, legacy audit, template library).
- [ ] `bun run test:component` / `bun run test:nuxt` — not run; required for full green `bun test` in CI if those projects are gated.

---

*Review pass: improve-architecture vs main — 2026-05-25*
