---
labels:
  - needs-triage
---

# Remove Nitro desktop bundle and align CI boundaries

## Parent

[PRD: Desktop Rust Local API migration](../prd/desktop-rust-local-api-migration.md) — release and cleanup.

## What to build

Remove Nitro sidecar packaging from the Tauri desktop build: drop bundled Node resources, sidecar spawn scripts, and desktop Nitro bundle steps from `package.json` / CI. Update [Tauri + SQLite Migration Strategy](../plan/tauri-sqlite-migration-strategy.md) to record **in-process Desktop Local API (Axum)** instead of bundled Nitro. Narrow or relocate server-focused Vitest that no longer applies after logic moved to Rust; keep UI-focused tests.

Nuxt desktop build ships static client only (`ssr: false` / `frontendDist` per implementation decision during triage).

## Acceptance criteria

- [ ] Tauri release build succeeds without Nitro artifacts under `src-tauri/resources/nitro/` (or equivalent) unless explicitly opted for dev-only tooling.
- [ ] Desktop build scripts and docs no longer instruct spawning Node for API.
- [ ] Migration strategy doc updated; `Docs/desktop-startup.md` reflects Rust-only milestones.
- [ ] CI test matrix runs appropriate Rust + UI tests; obsolete Nitro-sidecar integration assumptions removed.
- [ ] No regression to **Desktop IPC** for keychain, data folder, external URLs.

## Blocked by

- [0024 — Planner-safe cutover startup](./0024-planner-safe-cutover-startup.md)
- [0025 — Cutover feature gates and deferred routes](./0025-cutover-feature-gates-and-deferred-routes.md)
