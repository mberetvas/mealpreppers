---
labels:
  - needs-triage
---

# Desktop API platform milestone — shadow server plumbing

## Parent

[PRD: Desktop Rust Local API migration](../prd/desktop-rust-local-api-migration.md) — phase 1 **Desktop API platform milestone**.

## What to build

Stand up the **Desktop Local API** skeleton on a **shadow** loopback port while **Nitro remains the only user-facing API**. Tauri spawns in-process Axum at startup; the WebView and Loop A dev workflow still talk to Nitro. Shadow server exposes `/health`, runs **install database** open + **Rust-owned migrations** (`src-tauri/migrations/`), and mounts shared middleware: **H3-compatible error mapping**, **desktop token gate** (when configured), and **request context** (Trace ID + **Planning Principal** + structured logging). No full domain route implementations yet beyond what is needed to prove the stack (e.g. health only).

Developers can hit the shadow port in tests with an ephemeral `DATABASE_PATH` / data dir without sharing Nitro’s Drizzle ledger.

## Acceptance criteria

- [ ] Axum listens on `127.0.0.1:{shadow_port}`; Tauri startup spawns it without starting a Node child for the shadow server.
- [ ] `GET /health` returns success; Tauri can poll readiness (same contract as today’s sidecar health wait pattern).
- [ ] SQLite opens with WAL + foreign keys; migrations apply cleanly on empty and upgraded dev DBs under `src-tauri/migrations/`.
- [ ] Errors use H3 shape (`statusCode`, `statusMessage`, optional `message`, optional `data`); `501` responses include `data.code` = `desktop.api.not_implemented` when used by stub/deferred handlers.
- [ ] When `DESKTOP_TOKEN` is set, `/api/**` requires timing-safe `X-Desktop-Token`; `/health` and recipe-image paths remain unauthenticated per current policy.
- [ ] Trace ID and Planning Principal resolve on a sample authenticated API route stub (or test-only route) with log lines using `domain.action` event names.
- [ ] Startup timing logs include Rust API milestones (alongside or replacing sidecar fields only where this slice adds shadow timing).
- [ ] Rust integration tests cover `/health`, migrations, token rejection, and at least one golden error JSON.
- [ ] Loop A (`bun run dev` / Nuxt HMR) unchanged; documented dev note: reset `.data` or separate `DATABASE_PATH` when switching Nitro vs Rust migrators.
- [ ] Nitro child still serves all user APIs in packaged and dev desktop flows.

## Blocked by

None — can start immediately.
