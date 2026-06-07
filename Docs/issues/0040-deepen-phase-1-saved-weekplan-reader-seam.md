---
labels:
  - ready-for-agent
---

# Deepen — Phase 1: Unify Saved Weekplan reads through SavedWeekplanReader

## Parent

[Deepen Planning Shopping UI plan](../../.cursor/plans/deepen_planning_shopping_ui_000a5b3e.plan.md) — **Phase 1 / PR-A** (Saved Weekplan reader seam).

## What to build

Make `SavedWeekplanReader` the single access seam for **principal-scoped Saved Weekplan reads**. Today list queries SQLite directly while get/update/delete partially use the reader; handlers mostly bypass the composition root.

Extend the reader port with `listForPrincipal(db, principal)` returning rows sufficient to compute shopping-list flags (`id`, `name`, `updatedAt`, `body`, `consolidatedShoppingList`). Implement in the SQLite adapter with the same semantics as today's list: owned rows only; legacy unowned rows excluded from list.

Thin the Saved Weekplans repository so list delegates to the reader, then applies flag computation per row. Require an explicit reader argument on get, list, update, and delete repository functions (remove implicit default adapter).

Wire all Saved Weekplan HTTP handlers (list, get, patch, delete — create already uses composition) through `createPlanningDeps` so they receive the reader from the composition root.

Simplify update/delete authorization: after reader access checks pass, write by `id` only (drop redundant principal SQL filter on write, or document as defense-in-depth — pick one and stay consistent).

Add an in-memory reader fake (second adapter proves the seam) and extend repository/handler tests: list behavior, legacy unowned GET → not found, wrong **Planning Principal** → forbidden.

**Out of scope:** consolidation injection (0041), shared DTO migration, weekly-plan UI decomposition, Rust changes.

## Acceptance criteria

- [ ] Every principal-scoped Saved Weekplan read (list and get-by-id) crosses `SavedWeekplanReader`; no direct list SQL in the repository.
- [ ] All Saved Weekplan handlers (GET list, GET/PATCH/DELETE by id) receive the reader via the planning composition root.
- [ ] List semantics unchanged: owned rows only; legacy unowned rows absent from list; legacy unowned GET still returns not found.
- [ ] Wrong-owner access still returns forbidden on get/update/delete.
- [ ] Unit tests cover list, legacy unowned GET, and wrong-owner cases using the SQLite adapter and an in-memory reader fake.
- [ ] `just test` passes.

## Blocked by

None — can start immediately.
