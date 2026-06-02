---
labels:
  - needs-triage
---

# DDD hardening — Phase 2b copy-on-match consolidated shopping list

## Parent

[DDD Desktop Architecture plan](../../.cursor/plans/ddd_desktop_architecture_64de08fc.plan.md) — **Plan Phase 2** (**critical UX**: desktop copy-notice banner).

## What to build

Port **`copyConsolidatedListFromMatchingPlan`** logic into **shopping_list** **`infrastructure/`**. Define **`ConsolidatedShoppingListCopyPort`** in **`planning/ports/`** (consumer defines port); wire on **`AppState`**. Orchestrate in **`application/create_saved_weekplan.rs`**: after insert, call copy port; set **`shoppingListCopiedFromMatch`** on **`POST /api/v1/saved-weekplans`** JSON.

**PATCH must not copy** (mirror **`test/unit/copy-on-match-shopping-list.test.ts`**). Document SQLite transaction choice (atomic create+copy vs TS separate steps) in PR or ADR.

Add integration tests prefix **`copy_on_match_`**: copies list + flag true; principal isolation; fingerprint mismatch; tie-break by **`confirmedAt`**; deprecated list skipped; optional **`copy_on_match_no_copy_on_patch`**.

## Acceptance criteria

- [ ] All **`copy_on_match_*`** integration tests green.
- [ ] **`shoppingListCopiedFromMatch: true`** when match copies consolidated list.
- [ ] PATCH does not invoke copy / does not set flag.
- [ ] Copy only via **`ConsolidatedShoppingListCopyPort`** — no shopping SQL in **`planning::repository.rs`**.
- [ ] **Mandatory regression:** full Phase 1 gate + Phase 2a filters (`saved_weekplan`, `month_plan`, `missingRecipeIds`).
- [ ] Desktop sidecar: copy-notice banner on matching create.

## Blocked by

- [0032 — DDD Phase 2a Planning ports and CRUD](./0032-ddd-phase-2a-planning-ports-crud.md)
