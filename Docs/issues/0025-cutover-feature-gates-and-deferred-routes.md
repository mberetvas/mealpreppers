---
labels:
  - needs-triage
---

# Cutover feature gates and deferred Desktop Local API routes

## Parent

[PRD: Desktop Rust Local API migration](../prd/desktop-rust-local-api-migration.md) — cutover UX + deferred backend contract.

## What to build

Complete the **planner-safe cutover** product guarantee: happy paths never call phase-2 APIs. Register deferred routes on the **Desktop Local API** that return `501` with `data.code` = `desktop.api.not_implemented` (not stub success). In the Nuxt UI, gate **recipe URL import** on add-recipe and **consolidated shopping** UI; default `/shopping-list?plan=<id>` without `view` to **sections** (recipe-grouped list). Copy explains unavailable features until **Desktop backend phase 2**.

## Acceptance criteria

- [ ] Deferred preview and consolidation routes exist on Rust and return stable `501` + `desktop.api.not_implemented` JSON.
- [ ] Shopping list opens **sections** tab when `view` is omitted.
- [ ] Consolidated tab and URL import entry points are hidden or disabled with clear user-facing copy at cutover.
- [ ] Accidental client calls to deferred routes are test-covered (status + `data.code`).
- [ ] Component/nuxt tests updated only for gate behavior (not Rust business rules).
- [ ] Offline v1 guarantee documented: sections shopping + planner + catalog work; consolidated/AI/import explicitly unavailable.

## Blocked by

- [0024 — Planner-safe cutover startup](./0024-planner-safe-cutover-startup.md)
