---
labels:
  - needs-triage
---

# DDD hardening — Phase 0 platform foundation

## Parent

[DDD Desktop Architecture plan](../../.cursor/plans/ddd_desktop_architecture_64de08fc.plan.md) — **Plan Phase 0** (platform; must complete before Phase 1 traits).

## What to build

Harden **shadow_server** platform plumbing without changing product route behavior: introduce a unified **`platform::RepoError`** used by all slices (merge catalog’s smaller enum with planning/shopping variants), fix stale **`routes.rs`** module comments that still describe preview/consolidated routes as **501**, add **`wire.rs`** with `WirePhase` and a stub **`wire_dependencies`** called from **`build_router`**, document the **Plan Phase N ≠ routes.rs comment Phase N** legend, update migration-strategy and dev-matrix notes (Rust/sqlx in Axum box; `MEALPREPPER_SIDECAR=1` / packaged app = Rust API only), and stub **`Docs/architecture/desktop-domain-layers.md`** with phase legend and composition-root location.

Per-slice handlers keep current behavior; no slice **`application/`** folders yet.

## Acceptance criteria

- [ ] Phase 0 integration filters green: `health_`, `migrations_`, `token_`, `stub_` (`cargo test --test shadow_server_integration <prefix>_`).
- [ ] Recipe Catalog, Planning, and Shopping List compile against **`shadow_server/platform/repo_error.rs`** with thin **`From<platform::RepoError> for AppError`** mappers (per slice or centralized in `error.rs`).
- [ ] **`routes.rs`** header accurately reflects **`build_router`** (no false 501 list for live routes).
- [ ] **`wire.rs`** exists; **`wire_dependencies`** stub is invoked from **`build_router`**.
- [ ] **`desktop-domain-layers.md`** stub includes phase legend, per-slice route table placeholders, and composition root path.
- [ ] **`tauri-sqlite-migration-strategy.md`** §4 states Axum uses **Rust/sqlx**, not Drizzle.
- [ ] No product API behavior change (parity with current ~90 integration tests outside Phase 0 filters).

## Blocked by

None — can start immediately.

## Sequence

**1/12** in DDD hardening chain **0028 → 0039** ([README](./README-ddd-0028-0039.md)).
