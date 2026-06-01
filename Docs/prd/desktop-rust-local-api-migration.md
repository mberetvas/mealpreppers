# PRD: Desktop Rust Local API migration

**Status:** Draft  
**Source:** Architecture grill session (2026-06); vocabulary in root `CONTEXT.md` (Desktop section)  
**Related:** [Tauri + SQLite Migration Strategy](../plan/tauri-sqlite-migration-strategy.md) (supersedes Nitro-sidecar backend target for desktop), [Desktop development](../desktop-development.md), [Desktop startup](../desktop-startup.md)

---

## Problem Statement

Mealprepper desktop today ships a **bundled Node/Nitro child process** to serve `/api/v1/*`, SQLite, and local recipe images on loopback. That adds cold-start cost (Node boot, sidecar health polling), duplicates runtime (Rust shell + Node server), and ties persistence to JavaScript (`better-sqlite3`, Drizzle) inside the sidecar bundle. The team wants a **fully Rust backend** inside Tauri while keeping the existing Nuxt UI and HTTP URL shapes (`$fetch` to `/api/v1/...`), with **Desktop IPC** reserved for OS integration only (keychain, data folder, external URLs).

There are **no production users yet**, so schema and dev-database resets are acceptable; backwards compatibility with Drizzle’s migration ledger is **not** required.

## Solution

Replace the Nitro sidecar with an **in-process Desktop Local API** (Axum on `127.0.0.1:{port}`) that preserves `/health`, `/api/v1/*`, and recipe-image routes. Deliver in three program phases:

1. **Desktop API platform milestone** — Rust stack online on a **shadow** loopback port; Nitro still serves all user APIs; Loop A remains the default UI dev path.
2. **Planner-safe cutover** — Stop the Nitro child; Rust serves Recipe Catalog (including images), **Saved Weekplans**, and month-plans; apply **cutover feature gates** in the UI for deferred capabilities; register deferred routes with `501` + `desktop.api.not_implemented`.
3. **Desktop backend phase 2** — Recipe URL import (preview pipeline) and shopping-list consolidation (AI polish, saved consolidated list persistence).

The Nuxt app stays the client: static/`ssr: false` desktop build, same `$fetch` and desktop bootstrap token model until cutover; no domain CRUD via `invoke`.

## User Stories

### Platform and reliability

1. As a desktop user, I want the app to start without spawning Node, so that cold start is faster and the install is simpler.
2. As a desktop user, I want core planner and recipe flows to work offline after cutover, so that meal planning does not depend on network.
3. As a developer, I want a `/health` liveness probe on the Desktop Local API, so that the Tauri shell can wait for readiness before navigating the WebView (same as today’s sidecar contract).
4. As a developer, I want startup timing milestones for the Rust API, so that cold-start regressions are measurable.
5. As a developer, I want Loop A (Nuxt HMR) unchanged during the platform milestone, so that UI work is not blocked by backend migration.

### Security and identity

6. As a desktop user, I want API calls on loopback protected by a per-launch desktop token when enforcement is active, so that other local processes cannot drive mutations casually.
7. As a planner, I want **Saved Weekplans** scoped to the install’s **Planning Principal**, so that ownership rules match today’s single-user desktop model.
8. As a developer, I want **Trace ID** propagated on Desktop Local API requests, so that logs correlate with **Application Logger** vocabulary in `CONTEXT.md`.

### Recipe Catalog

9. As a meal planner, I want to list, view, create, edit, and delete recipes after cutover, so that the Recipe Catalog remains fully usable without Nitro.
10. As a meal planner, I want recipe images to load from local storage via HTTP, so that cards and detail pages render offline.
11. As a meal planner, I want recipe options (categories/tags) available for filters and forms, so that add/edit recipe UX is unchanged.
12. As a meal planner, I want bulk delete on the recipes page to work with the same error feedback as today, so that batch cleanup is not regressed.

### Planning

13. As a meal planner, I want to list, create, open, patch, and delete **Saved Weekplans** after cutover, so that weekly planning persistence is intact.
14. As a meal planner, I want month-plans CRUD after cutover, so that the weekly planner’s month overlay continues to work.
15. As a meal planner, I want invalid recipe references on save to return a clear 400 with missing recipe ids, so that I can fix the grid without opaque failures.
16. As a meal planner, I want unexpected planner errors to return a generic message plus `errorId` in the response data, so that support can correlate logs.

### Cutover feature gates (phase 2 deferred on backend)

17. As a meal planner opening `/shopping-list?plan=<id>` without a `view` query, I want to land on **sections** (recipe-grouped list), so that offline shopping works without consolidation APIs.
18. As a meal planner at cutover, I want consolidated shopping UI hidden or disabled with clear copy, so that I am not dropped into a broken auto-consolidate flow.
19. As a meal planner at cutover, I want URL import on add-recipe hidden or disabled with explanation, so that I am not invited to use preview APIs that are not implemented yet.
20. As a developer, I want accidental calls to deferred routes to receive `501` with `data.code` = `desktop.api.not_implemented`, so that clients and tests have a stable contract.

### Shopping list (post–phase 2 backend)

21. As a meal planner, I want **Shopping list consolidation** and **Saved consolidated shopping list** read/write after backend phase 2, so that consolidated tab and AI polish return per ADR 0002–0004.
22. As a meal planner, I want **recipe URL import** (preview from URL) after backend phase 2, so that add-recipe ingestion matches today’s capability.

### Settings and secrets

23. As a desktop user, I want my OpenRouter key to stay in the OS keychain and reach the backend at runtime (not in the WebView bundle), so that AI features remain secure when re-enabled in phase 2.
24. As a desktop user, I want Settings to continue opening the data folder and showing app version via **Desktop IPC**, so that OS integration is unchanged.

### Development and migration

25. As a developer, I want Rust migrations under the Tauri crate with sqlx (or equivalent), so that schema evolution is owned by the Rust stack.
26. As a developer, I want to reset dev data or use separate `DATABASE_PATH` / `MEALPREPPER_DATA_DIR` when switching between Nitro and Rust migrators during the platform milestone, so that I do not corrupt a shared `.data` directory.
27. As a developer, I want integration tests against the shadow Rust port during the platform milestone, so that `/health`, migrations, and middleware are verified before cutover.
28. As a developer, I want planner-safe cutover exercised via the sidecar integration loop (loop B equivalent) with Rust as the only API process, so that production-like desktop behavior is testable before release.

### Release and cleanup

29. As a maintainer, I want Nitro desktop bundle scripts and bundled Node resources removed after cutover, so that the repo matches the Rust-only backend topology.
30. As a maintainer, I want server-focused Vitest replaced or narrowed to UI-only tests where logic moved to Rust, so that CI reflects the new boundaries.

## Implementation Decisions

### Transport and topology

- **Desktop Local API** runs in-process (Axum), bound to `127.0.0.1:{port}`; same path shapes as today (`/health`, `/api/v1/*`, recipe-images).
- **Desktop IPC** remains for OS integration only; domain data uses HTTP, not `invoke`.
- **Nitro child process** is removed at **planner-safe cutover**, not at the platform milestone.
- Optional future `MEALPREPPER_RUST_API` / bootstrap flip is deferred until pre-cutover; platform milestone uses a **shadow port** only.

### Phased delivery

| Phase | User APIs | Nitro child | UI |
|--------|-----------|-------------|-----|
| Desktop API platform milestone | Nitro (all) | Yes | Loop A default; shadow Rust for tests |
| Planner-safe cutover | Rust: catalog + images + Saved Weekplans + month-plans | No | Cutover feature gates; sections default on shopping list |
| Desktop backend phase 2 | Rust: + preview + consolidation routes | No | Re-enable gated features |

### Deep modules (build or extend)

1. **Local API server** — Axum router, listener lifecycle, graceful shutdown on app exit, `/health`; single entry to mount route modules. *Deep:* hides Tokio runtime and middleware stack behind `start_shadow` / `start_primary` (or equivalent).
2. **Install database** — Resolve app data dir and DB path (aligned with today’s env vars); open SQLite with WAL and foreign keys; run versioned SQL migrations at startup. *Deep:* migrations + pool; no SQL in handlers.
3. **API error mapping** — H3-compatible JSON: `statusCode`, `statusMessage`, optional `message`, optional `data`; optional `data.code` for `501` and unexpected `500`; preserve domain `data` fields (e.g. `missingRecipeIds`, `errorId`). *Deep:* one `IntoResponse` path for all handlers.
4. **Desktop token gate** — Timing-safe compare of `X-Desktop-Token` on `/api/**` when token is configured; `/health` and static recipe images unauthenticated per current policy.
5. **Request context** — Resolve **Trace ID** (header precedence per `CONTEXT.md`), **Planning Principal** from install `local-user-id`, request-scoped logger; mirror **Planning Request Context** responsibilities for planning routes.
6. **Recipe catalog slice** — Repository + validation + local image storage/serve; port behavior from existing Nitro services (list, CRUD, options, bulk delete, upload image).
7. **Planning slice** — Saved Weekplans and month-plans repositories and handlers; principal scoping; deprecation flags for consolidated list where schema requires.
8. **Deferred route registry** — At cutover, register consolidation and preview routes that return `501` + `desktop.api.not_implemented` (not stub success).
9. **Tauri startup integration** — Spawn shadow server during platform milestone; at cutover replace Nitro spawn with in-process server and existing bootstrap (`apiBase` + token); retain startup timing fields adapted for Rust health wait.
10. **Structured logging** — Rust equivalent of trace-aware, redacted logs; **Log Event Name** `domain.action` snake_case.

### Schema and migrations

- New migration history under Tauri (`src-tauri/migrations/`); applied by sqlx migrate (or refinery)—**no** Drizzle `__drizzle_migrations` compatibility.
- Initial SQL ported from current recipe catalog + planning schema (two migration tranches equivalent to existing Drizzle SQL).
- Dev policy: reset DB or separate data dir when alternating Nitro vs Rust migrators during platform work.

### API contract (errors)

- Match ofetch/H3 error bodies; no new top-level envelope.
- `501`: human `statusMessage` + `data.code` = `desktop.api.not_implemented`.
- Unexpected `500`: generic slice message + `data.errorId` (UUID); optional `data.code` for logging.
- Domain `400` responses preserve existing `data` shapes (e.g. `missingRecipeIds`).

### Frontend (cutover)

- Shopping list: default `view=sections` when `view` omitted; disable/hide consolidated tab and URL import until backend phase 2.
- Keep `01.desktop-api.client.ts` token attachment for loopback `$fetch`.
- Desktop build: drop Nitro sidecar output from bundle; Nuxt static client only (details in implementation, not v1 of this PRD’s platform milestone).

### Phase 2 backend (out of cutover scope)

- **Recipe ingestion** — URL fetch, scrapers, optional Playwright bridge, preview normalizers; OpenRouter not required for read-only catalog.
- **Shopping list** — Consolidation, merge rules, aisle logic, OpenRouter polish chain, **Saved consolidated shopping list** persistence; keychain-injected API key at runtime.

### Modules explicitly not in platform milestone

- Full route implementations (only plumbing + shadow `/health` + migrations).
- Recipe ingestion and shopping-list consolidation logic.
- Removal of `server/` directory and Nitro bundle scripts (cutover / cleanup).

## Testing Decisions

### What makes a good test

- Assert **HTTP status and JSON body** (and headers where relevant: desktop token, trace), not internal handler structure.
- Prefer integration tests that hit loopback with a temp database path over mocking SQLite in unit tests for repositories.
- For Rust: `#[test]` and async integration tests with ephemeral `DATABASE_PATH`; golden JSON for error bodies against Vitest expectations where planning/recipe errors are already specified.

### Modules to test (recommended)

| Module | Platform milestone | Cutover | Phase 2 |
|--------|-------------------|---------|---------|
| Install database + migrations | Yes | Yes | — |
| API error mapping | Yes | Yes | — |
| Desktop token gate | Yes | Yes | — |
| `/health` + server lifecycle | Yes | Yes | — |
| Request context / trace | Partial | Yes | — |
| Recipe catalog slice | — | Yes | — |
| Planning slice | — | Yes | — |
| Deferred `501` routes | — | Yes | — |
| Recipe ingestion | — | — | Yes |
| Shopping list consolidation | — | — | Yes |

### Prior art

- Vitest: `test/unit/desktop-token-middleware.test.ts`, `test/unit/planning-request-context.test.ts`, `test/unit/saved-weekplans-planning-handler-seam.test.ts` (error `errorId`, `statusMessage`).
- Rust: existing `sidecar` bootstrap script test pattern in the Tauri crate.
- Recipe/planning repository tests today using isolated SQLite paths in Node—mirror with temp dirs in Rust.

### UI tests

- Component/nuxt tests only where **cutover feature gates** change behavior (shopping list default tab, disabled import/consolidated UI); avoid re-testing Rust business rules in Vitest after cutover.

## Out of Scope

- Hosted web app, Supabase, or multi-user on one machine.
- Drizzle/`better-sqlite3` compatibility or reading `__drizzle_migrations` from existing installs.
- Domain CRUD via Tauri `invoke`.
- Planner-safe cutover including recipe URL preview or shopping-list consolidation (phase 2 backend).
- `MEALPREPPER_RUST_API` bootstrap flip during platform milestone (deferred to pre-cutover hardening).
- macOS/Linux signed releases, in-app updater, backup/restore zip (see desktop phase 2 tracker).
- Rewriting all Vitest server suites before cutover—narrow as slices move.
- Vendored fonts / fully offline UI chrome (existing v1 gap in `CONTEXT.md`).
- Changing **Public Recipe Catalog** visibility model or **Saved Weekplans** HTTP path names.

## Further Notes

- Update [Tauri + SQLite Migration Strategy](../plan/tauri-sqlite-migration-strategy.md) decision record when implementation starts—the “bundled Nitro sidecar” row becomes “in-process Desktop Local API (Axum).”
- Tracker issue draft for deferred UI/backend pairing exists at `Docs/issues/0020-desktop-phase-2-deferred.md`; align naming with **Desktop backend phase 2** in this PRD.
- After cutover, startup docs should replace `sidecar_spawn_ms` / Nitro migrate timing with Rust API milestones (`Docs/desktop-startup.md`).
- **Offline product guarantee (v1):** cutover must keep sections shopping list + planner + catalog offline; consolidated/AI/import remain explicitly unavailable until phase 2, not failing silently.
- Open question for a follow-up grill (not blocking PRD): sqlx vs refinery choice, Nuxt `frontendDist`/`ssr: false` packaging details, and whether to generate TypeScript DTOs from Rust or hand-maintain `types/`.
