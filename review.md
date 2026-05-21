# Code Review — Recent Changes (last ~5 commits + uncommitted tooling)

**Scope:** Shopping list generator, Saved Weekplans consolidation (legacy week-templates retirement), planning hydration migration, agent automation scripts (`cursor-ralph-loop.ps1`, `justfile`, `code-review.ps1`), audit/migration tooling for `legacy_unowned` rows.

**Overall:** The changes are well-structured: pure domain logic in `utils/shoppingList.ts`, principal-scoped persistence in `savedWeekplansRepository`, strong unit test coverage, and clear ADR/documentation for the week-templates retirement. A few UX edge cases, stale comments, and operational-security notes remain.

---

## Summary

| Area | Assessment |
|------|------------|
| Code quality & readability | **Good** — clear naming, doc comments, vertical slice for shopping list |
| Potential bugs | **Low–medium** — mostly SPA routing and partial-failure UX |
| Security | **Good** for plan access; note automation script flags and global recipe reads |
| Best practices | **Strong** — TDD, modular monolith, thin page adapter; minor DRY and orchestration gaps |

---

## 1. Code Quality & Readability

### Strengths

- **`utils/shoppingList.ts`** is exemplary: small pure functions (`collectRecipeOccurrences`, `buildShoppingList`, `formatShoppingListIngredient`), explicit types, and focused unit tests. Insertion-order semantics are documented and tested.
- **Saved Weekplans consolidation** cleanly moves week-grid CRUD into `savedWeekplansRepository` with `interpretSavedWeekplanAccess` at the boundary. Removing duplicate exports from `planningRepository` reduces dual-path confusion.
- **`app/pages/shopping-list.vue`** keeps orchestration in the page while delegating aggregation/formatting to utils — aligns with “thin adapter” architecture.
- **Test mirror** in `test/unit/shopping-list-page.test.ts` documents the fetch pipeline and catches regressions in occurrence counting, partial failures, and ordering.
- **ADR + audit trail** (`docs/adr/0001-...`, `Docs/audits/001-...`, `auditLegacyUnownedWeekTemplates`) make the migration reversible and reviewable.

### Improvements

1. **Extract shared load orchestration**  
   `shopping-list.vue` and `shopping-list-page.test.ts` duplicate the same `loadShoppingList` pipeline. Consider a composable (e.g. `useShoppingList(planId)`) so the page and tests share one implementation and drift is impossible.

2. **DRY recipe slot traversal**  
   `collectRecipeOccurrences` (utils) and `collectRecipeIdsFromWeekPlan` (planningRepository) walk the same 21 slots with different return shapes. A single internal iterator (e.g. `forEachWeekPlanSlot(plan, fn)`) would keep ordering rules in one place.

3. **Stale documentation comment**  
   In `server/services/planning/savedWeekplanAccess.ts` line 18:
   > "Legacy rows … are only exposed via legacy week-templates routes."  
   Those routes were removed. Update to: "Legacy rows return 404 on Saved Weekplans API until backfilled or purged."

4. **`planningHydration.ts` naming**  
   `fetchWeekTemplateRowForPlanner` still says "template" while calling `/api/v1/saved-weekplans/`. Rename when convenient (e.g. `fetchSavedWeekplanForPlanner`) to match domain language in CONTEXT.md.

---

## 2. Potential Bugs & Issues

### Medium priority

1. **No reload when `?plan=` query changes (SPA)**  
   `shopping-list.vue` calls `load()` only in `onMounted`. Navigating from `/shopping-list?plan=A` to `?plan=B` without a full remount will show stale data.  
   **Fix:** `watch(planId, load)` or `watch(() => route.query.plan, load)`.

2. **All recipe fetches fail → confusing UI**  
   When `planLoaded && sections.length === 0 && failedRecipeCount > 0`, the user sees only the warning banner and no sections — not the "no recipes" empty state (correctly gated on `failedRecipeCount === 0`). Consider a dedicated message: "Could not load any recipes for this plan."

3. **Floating-point quantities**  
   `quantity * occurrenceCount` can produce `0.30000000000000004`. Tests use integers; real data may not. Consider rounding (e.g. 2 decimal places) in `buildShoppingList` or `formatShoppingListIngredient`.

### Low priority

4. **`v-for` key on ingredients uses index** (`:key="idx"`)  
   Safe if ingredients are static per load; prefer `ing.id` or a stable composite if ingredient lists can reorder.

5. **Empty `planId` shows same error as 403/404**  
   Missing `?plan=` and unauthorized plan both set `planError`. Optional: distinguish "No plan selected" with a link to Saved Weekplans.

6. **`cursor-ralph-loop.ps1` stderr handling**  
   Stderr is read only after `WaitForExit()`. A chatty agent could theoretically block if stderr buffer fills (uncommon). Reading stderr on a background task or merging streams is more robust.

### Verified OK

- Principal scoping on `getSavedWeekplanById` (404 for `legacy_unowned`, 403 for `wrong_owner`).
- Unique recipe IDs fetched once per plan (`Map` + `Promise.allSettled`).
- Nudge `planId` cleared on template switch (`weekly-plan.vue` line ~225) — avoids stale shopping-list links after loading another plan.

---

## 3. Security Considerations

### Good

- **Plan access:** Shopping list loads plans via `/api/v1/saved-weekplans/:id` with `withPlanningHandler` and `interpretSavedWeekplanAccess` — IDOR mitigated for week plans.
- **No secrets in client code** for shopping list flow.
- **Legacy purge SQL** is documented as one-off, transactional, with pre-count guidance.

### Notes / recommendations

1. **Recipe catalog is globally readable**  
   `/api/v1/recipes/:id` has no principal check. Acceptable if all catalog recipes are public; if you add private recipes later, shopping list must not leak them via predictable UUIDs. Document assumption or add scoped batch fetch.

2. **`plan` query parameter**  
   UUID in URL is shareable. Anyone with the link and a valid session could open the list if they own the plan (or anon session matches). Expected for personal apps; avoid putting PII in plan names if URLs are shared.

3. **Agent automation (`cursor-ralph-loop.ps1`)**  
   Uses `--force`, `--trust`, `--approve-mcps`. Appropriate for trusted local automation; **do not** run unattended on production machines or with repo secrets in reach without sandboxing. Document in `Docs/ralph-loop/` README.

4. **`code-review.ps1` uses `--force`**  
   The review agent can modify the workspace. For read-only reviews, drop `--force` or add a `-ReadOnly` switch.

5. **Audit script uses service-role Supabase client**  
   `scripts/audit-legacy-unowned-week-templates.ts` — ensure it only runs in CI/ops with `.env` not committed (already standard; worth a one-line warning in script header).

---

## 4. Best Practices Compliance

### Aligns with project rules (AGENTS.md)

| Practice | Status |
|----------|--------|
| Modular monolith / vertical slice | ✅ Shopping list utils + page; planning in repository |
| Thin API routes | ✅ Handlers delegate to `savedWeekplansRepository` |
| TDD | ✅ Extensive unit tests for shopping list, repository, ADR guards |
| Bun (not npm) | ✅ Scripts use `bun` |
| Structured logging / trace IDs | ✅ Continued in planning/recipe handlers (recent trace propagation commits) |

### Gaps

1. **N+1 HTTP for recipes**  
   Up to 21 parallel `$fetch` calls per plan load. Fine for MVP; consider `GET /api/v1/recipes?ids=...` or server-side "shopping list for plan" endpoint to reduce round-trips and centralize auth.

2. **No ingredient deduplication / merge**  
   List is per-recipe sections, not aggregated shopping items. Product choice, not a bug — document in UX if users expect "200g pasta" merged across meals.

3. **Page-level error handling swallows detail**  
   `catch { planError.value = true }` — no trace ID or logging on client. Server errors are opaque (good for users); consider `console.debug` in dev or a shared `useFetchError` helper for support.

4. **Uncommitted `justfile` recipe**  
   `cursor-ralph-quiet` passes `-ShowProgress:$$false` — verify on your `just` version that `$$` becomes `$false` in PowerShell (just escaping). If not, quiet mode may not work.

---

## 5. Specific Suggestions (actionable)

### High value, small effort

```typescript
// shopping-list.vue — reload when query changes
watch(planId, () => { void load() })
```

```typescript
// savedWeekplanAccess.ts — update comment (line 17–18)
// Legacy rows (both owner columns null) are hidden from Saved Weekplans (404).
// Backfill or purge per Docs/audits/001-legacy-unowned-week-grid-rows.md.
```

### Medium effort

- Add composable `useShoppingList(planId: Ref<string>)` returning `{ loading, planName, sections, planError, failedRecipeCount, refresh }`.
- Add UI branch when `failedRecipeCount > 0 && sections.length === 0`.
- Round displayed quantities: `Math.round(q * 100) / 100` before format.

### Larger / follow-up

- Batch recipe resolution API for shopping list.
- Rename `fetchWeekTemplateRowForPlanner` → `fetchSavedWeekplanForPlanner` across codebase.
- `code-review.ps1`: optional `-ReadOnly` without `--force`; verify `review.txt` is written even on non-zero exit (agent may still produce output).

---

## 6. Files Reviewed (representative)

| File | Notes |
|------|-------|
| `utils/shoppingList.ts` | Clean, well-tested |
| `app/pages/shopping-list.vue` | Good UX states; missing route watch |
| `app/components/plan/ShoppingListNudge.vue` | Simple, accessible |
| `server/services/planning/savedWeekplansRepository.ts` | Correct principal scoping |
| `server/services/planning/savedWeekplanAccess.ts` | Stale comment |
| `utils/planningHydration.ts` | Correct API migration |
| `server/api/v1/planning/week-templates/*` | Removed ✅ |
| `Docs/ralph-loop/cursor-ralph-loop.ps1` | Solid streaming UX; trust flags documented |
| `scripts/code-review.ps1` | Model param added ✅ |
| `justfile` | Useful automation recipes |
| `test/unit/shopping-list*.ts` | Thorough |

---

## 7. Conclusion

Recent work is **production-quality for an MVP shopping list** and **architecturally sound** for Saved Weekplans as the single persistence path. Before wider release, address **route query watching**, **partial-total-failure UX**, and **stale access comments**. Plan **batch recipe loading** when plan sizes or catalog privacy requirements grow.

No blocking security defects found in the application paths reviewed; treat agent automation scripts as **privileged local tools** only.

---

*Generated by code review pass — 2026-05-21*
