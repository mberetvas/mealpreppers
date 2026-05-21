# Shopping list — pre-release fixes (gate B)

**Status:** draft (local)  
**Source:** Code review (`review.md`) + grill-with-docs session (May 2026)  
**Release gate:** Fix three pre-release items only; defer all other review follow-ups.

---

## Problem Statement

Users opening a **Shopping list** from **Saved Weekplans** can hit confusing or stale behavior before a wider release:

1. **Stale list on in-app navigation** — Changing the **Shopping list plan link** (`?plan=`) via client-side routing (e.g. opening another plan from Manage plans) does not reload data because load runs only once on mount. The UI can show the previous plan’s **recipe sections** until a full page refresh.

2. **Ambiguous total failure** — When the **Saved Weekplan** loads but **shopping list total recipe resolution failure** occurs (every referenced **Recipe Catalog** entry fails), the page shows only the partial-load warning banner with no **recipe sections** and no dedicated explanation. Users cannot tell this apart from **Shopping list empty plan** (no slots assigned) or from plan access errors.

3. **Misleading ops documentation** — The **Saved Weekplan** access classifier still documents `legacy_unowned` rows as exposed via retired week-templates HTTP routes. That contradicts ADR 0001 and risks wrong migration assumptions.

---

## Solution

Ship a small, focused patch that:

- Reloads the **Shopping list** whenever the **Shopping list plan link** changes, showing the loading skeleton immediately (no stale content from the prior plan).
- Adds a dedicated UI state for **shopping list total recipe resolution failure**: existing warning banner plus a parchment empty block with agreed copy and a single **Open in Planner** action (header **Refresh** remains the retry path).
- Updates the access-classifier doc comment to state that `legacy_unowned` rows are hidden from Saved Weekplans (404) and point operators to the legacy-unowned audit runbook.

Domain language is defined in `CONTEXT.md` (**Shopping list** section). Architecture for Saved Weekplans remains ADR 0001.

---

## User Stories

1. As a meal planner, I want the shopping list to reload when I open a different Saved Weekplan from the same page without a full browser refresh, so that I always see ingredients for the plan I selected.

2. As a meal planner, I want to see a loading indicator as soon as I switch plans, so that I am not misled by the previous plan’s ingredient list.

3. As a meal planner, I want the page title to update after a plan switch, so that the header matches the loaded Saved Weekplan.

4. As a meal planner, when every recipe in my plan fails to load, I want a clear message that recipes could not be loaded (not that the plan is missing), so that I know my Saved Weekplan loaded but the list could not be built.

5. As a meal planner, when every recipe fetch fails, I want to still see my plan name in the header, so that I know I am on the correct Saved Weekplan.

6. As a meal planner, when all recipes fail to load, I want the partial-load warning to remain visible, so that I understand the failure mode is recipe resolution, not plan access.

7. As a meal planner, when all recipes fail to load, I want a prominent empty-state block below the warning, so that the screen is not blank apart from a small banner.

8. As a meal planner, when all recipes fail to load, I want copy that mentions the catalog and suggests Refresh, so that I know what to try first.

9. As a meal planner, when all recipes fail to load, I want an Open in Planner action, so that I can inspect or fix recipe assignments without hunting for navigation.

10. As a meal planner, when all recipes fail to load, I do not need a second Refresh button in the empty block, so that the UI stays simple (header Refresh is sufficient).

11. As a meal planner with a plan that has no recipe slots, I still want the existing “This plan has no recipes yet” empty state, so that empty grids are not confused with catalog failures.

12. As a meal planner, when some but not all recipes fail, I want the existing partial-load warning plus the recipes that succeeded, so that a partial list is still useful.

13. As a meal planner, when the plan id is missing or access is denied, I still want the existing plan error state, so that authorization problems are not mixed with recipe failures.

14. As a meal planner navigating from Manage plans via shopping cart icon, I want correct list content on first visit, so that deep links continue to work (regression guard).

15. As a meal planner using the weekly planner shopping nudge, I want switching plans and opening the list to show the right plan, so that nudge links stay trustworthy after SPA navigation.

16. As a developer, I want route-query reactivity covered by tests or template assertions, so that the mount-only bug cannot return silently.

17. As a developer, I want total-failure UI gated on `planLoaded`, zero sections, and positive `failedRecipeCount`, so that the state machine stays explicit and testable.

18. As a developer, I want the total-failure state distinguishable from `failedRecipeCount === 0` empty plan, so that template branches do not overlap.

19. As a developer, I want orchestration tests for total failure to remain valid, so that `loadShoppingList` behavior and page presentation stay aligned.

20. As an operator, I want Saved Weekplan access documentation to say legacy unowned rows return 404 on Saved Weekplans, so that I do not assume a retired HTTP surface still exposes them.

21. As an operator, I want the classifier comment to reference the legacy-unowned audit runbook, so that I know where backfill and purge procedures live.

22. As a reviewer, I want gate B scoped strictly to these three fixes, so that composable extraction and batch APIs do not expand the release.

---

## Implementation Decisions

### Modules to build or modify

| Module | Role | Change |
|--------|------|--------|
| **Shopping list page** | Thin adapter: resolves **Shopping list plan link**, orchestrates Saved Weekplan + catalog fetches, renders UI states | Add reactive reload on plan id change; add total-failure template branch; keep existing partial-failure and empty-plan branches |
| **Shopping list load orchestration (test mirror)** | Duplicated pipeline used by unit tests today | No structural change required for gate B unless tests need new helpers for UI state predicates |
| **Saved Weekplan access classifier** | Pure ownership interpretation for Planning API | Documentation comment only — no behavior change |
| **Shopping list pure builder** | `collectRecipeOccurrences`, `buildShoppingList` | No change (gate B is presentation and lifecycle) |

### Deep modules (unchanged; rely on existing)

- **Recipe occurrence collector** — Walks week grid slots in deterministic order; already tested.
- **Shopping list builder** — Builds **recipe sections** from occurrences and catalog map; already tested.
- **Saved Weekplan access interpreter** — Returns `matched`, `legacy_unowned`, or `wrong_owner`; behavior already correct per ADR 0001.

### Shopping list page — lifecycle

- Watch the computed **Shopping list plan link** (plan query param) and invoke the existing load routine whenever it changes (including clearing to empty).
- On each load start: set loading true, clear plan error and failure counts as today, then fetch — **immediate skeleton (option A)**, not stale content until the new fetch completes.
- Keep `onMounted` load for first paint; watcher covers subsequent SPA navigations.

### Shopping list page — UI state machine

After loading completes and plan error is false:

| Condition | UI |
|-----------|-----|
| `planLoaded && sections.length === 0 && failedRecipeCount === 0` | **Shopping list empty plan** (unchanged) |
| `planLoaded && sections.length === 0 && failedRecipeCount > 0` | Warning banner + **shopping list total recipe resolution failure** block (new) |
| `planLoaded && sections.length > 0` | **Recipe sections** + optional partial warning if `failedRecipeCount > 0` (unchanged) |
| `planError` | Plan access error (unchanged) |

### Total failure copy and actions (locked)

- **Heading:** “Could not load recipes for this plan”
- **Body:** Some recipes could not be loaded from the catalog. Try Refresh or open the plan in the planner.
- **Primary action in empty block:** Open in Planner only (same destination as empty-plan state: weekly planner with plan id query)
- **No** duplicate Refresh in the empty block

### Saved Weekplan access classifier — comment

Replace stale “legacy week-templates routes” wording with:

- Legacy rows (both owner columns null) are hidden from Saved Weekplans (404).
- Backfill or purge per legacy-unowned week grid audit runbook.

No API or repository behavior change.

### Architectural alignment

- **ADR 0001** — Saved Weekplan remains sole persistence; shopping list continues to load plans via principal-scoped Saved Weekplans API.
- **Recipe Catalog** — Still loaded per recipe id from global catalog endpoints; gate B does not add batch fetch or server-side aggregate endpoint.
- **Per-recipe sections** — No cross-recipe ingredient merge (deferred product decision).

### Explicitly not doing in this PRD

- Extracting `useShoppingList` composable
- DRY slot iterator shared with planning repository
- Quantity rounding / floating-point display fixes
- Distinguishing missing plan id from 403/404 in copy
- Renaming planner hydration “template” symbols
- Updating audit 001 intro text (separate doc debt)
- `code-review.ps1` read-only mode or agent automation hardening

---

## Testing Decisions

### What makes a good test here

- Assert **observable behavior**: which template branch renders, which copy appears, that a plan-id change triggers a new fetch — not internal Vue watcher implementation details.
- Prefer stable selectors: roles, aria labels, visible headings, and navigation targets already used on the shopping list page.
- Keep orchestration tests focused on `failedRecipeCount` and section counts; add presentation tests for branches the orchestration tests cannot see.

### Modules to test

| Module | Test? | Rationale |
|--------|-------|-----------|
| Shopping list pure builder | No (gate B) | Already covered; no code change |
| Load orchestration mirror | Extend only if needed | Already asserts total failure data (`failedRecipeCount`, empty sections); confirms pipeline, not new UI |
| Shopping list page presentation | **Yes** | New branches and route watch are UI concerns |
| Saved Weekplan access classifier | No | Comment-only change |

### Prior art

- `shopping-list-page.test.ts` — orchestration mirror and resilience (`failedRecipeCount`, partial failure, all failures data plane).
- `saved-weekplans-shopping-cart-entry.test.ts` — template source assertions for navigation to shopping list with plan query.
- `weekly-plan-shopping-list-nudge.test.ts` — component-level nudge behavior.

### Recommended test cases (gate B)

1. **Total failure presentation** — When orchestration would yield `planLoaded`, zero sections, `failedRecipeCount > 0`, template includes total-failure heading copy and Open in Planner link with plan id; does not show “This plan has no recipes yet”.
2. **Empty plan unchanged** — Zero sections and `failedRecipeCount === 0` still shows empty-plan copy only.
3. **Plan link change** — Simulated or source-level assertion that load is tied to plan id changes (if full component mount test is heavy, document contract in page test file consistent with existing saved-weekplans pattern).

---

## Out of Scope

- Ingredient aggregation across **recipe sections** (merged pantry list)
- Batch recipe catalog API or server-side “shopping list for plan” endpoint
- `useShoppingList` composable extraction and test deduplication
- Shared week-slot iterator between shopping list utils and planning repository
- Floating-point quantity rounding in display
- Separate UX for missing `plan` query vs forbidden plan
- Ingredient list `v-for` key stability change
- Planner hydration rename (`template` → Saved Weekplan language in code symbols)
- Agent automation trust flags (`cursor-ralph-loop`, `code-review.ps1`)
- Audit 001 document intro update (still mentions retired routes)
- Any change to `legacy_unowned` runtime behavior (404 remains)

---

## Further Notes

- Parent feature context: initial shopping list generator PRD may exist as `shopping-list-generator.md`; this PRD is a **pre-release hardening** slice on top of shipped MVP behavior.
- Code review reference: `review.md` (2026-05-21); grill session locked release **gate B** only.
- After implementation, consider closing or annotating the three matching items in `review.md` §5 “High value” / §2 medium priority so the review doc does not contradict shipped behavior.
- Future grill topics (deferred): per-recipe vs merged **Shopping list** product model, agent automation ops model, prioritized backlog for remaining review items.
