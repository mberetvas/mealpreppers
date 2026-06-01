---
labels:
  - needs-triage
---

# Planning — Saved Weekplans and month-plans on Desktop Local API

## Parent

[PRD: Desktop Rust Local API migration](../prd/desktop-rust-local-api-migration.md) — planner-safe cutover scope (planning slice).

## What to build

Port **Saved Weekplans** and **month-plans** to the **Desktop Local API** in Rust: list, create, get, patch, delete for Saved Weekplans; month-plans CRUD used by the weekly planner overlay. Use **Planning Request Context** responsibilities (principal, trace, logger). Return `400` with `missingRecipeIds` in `data` when saves reference unknown recipes; unexpected errors return generic message plus `data.errorId` (UUID). HTTP paths remain `/api/v1/saved-weekplans` and month-plan routes (no legacy week-templates).

## Acceptance criteria

- [ ] Saved Weekplans CRUD matches existing API contract and principal scoping for `local-user-id`.
- [ ] Month-plans CRUD works for the weekly planner month overlay.
- [ ] Invalid recipe references on save return `400` with `missingRecipeIds` preserved in `data`.
- [ ] Unexpected planner failures return H3 body with `data.errorId` for support correlation.
- [ ] Rust integration tests cover happy paths and boundary cases (missing recipes, not found, principal isolation).
- [ ] Vitest planning handler seam tests’ JSON expectations remain valid against Rust responses (update goldens if needed).

## Blocked by

- [0021 — Desktop API platform plumbing](./0021-desktop-api-platform-plumbing.md)
- [0022 — Recipe Catalog on Desktop Local API](./0022-recipe-catalog-desktop-local-api.md)
