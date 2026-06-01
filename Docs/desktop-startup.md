# Desktop startup (profiling, fonts)

Companion to [desktop-development.md](./desktop-development.md) for **packaged / sidecar** cold start.

## What runs at launch

1. Tauri `setup_app` — `prepare_sidecar_launch` (port, token, data dir).
2. Main WebView — visible on `about:blank` with `initialization_script` (`window.__MEALPREPPER_DESKTOP__`).
3. Bundled Node + Nitro `server/index.mjs` — SQLite migrations in `00.sqlite-migrate` plugin.
4. Poll `GET /health` until 200 (200 ms interval, 60 s timeout).
5. `main.navigate(apiBase)` — first load of the Nitro app (init script runs again on navigation).
6. UI paint — fonts are bundled (no Google CDN).

On setup failure after `"main"` exists, the shell closes `main` before the fatal pause (no separate splash window).

**Dev loop A** (`bun run desktop:dev`): Nuxt on `localhost:3000`, direct `devUrl` main window, **no sidecar timing env**.

**Dev loop B / production** (`should_run_sidecar()`): blank main → sidecar spawn/health → navigate, as above.

## Startup timing (`MEALPREPPER_STARTUP_TIMING`)

Enable structured milestones in Rust and Nitro:

| Milestone | Source |
|-----------|--------|
| `setup_begin` | `StartupTiming::begin` |
| `shadow_api_spawned` | after in-process Axum shadow server binds (Desktop Local API phase 1) |
| `main_window_created` | after main `WebviewWindowBuilder::build` (blank shell, before health) |
| `main_window_shown` | after main is visible (before health) |
| `sidecar_spawned` | after Nitro `Command::spawn` |
| `sidecar_healthy` | after `/health` 200 |
| `main_navigated` | after `main.navigate(apiBase)` |
| Summary line | `main_shell_ms`, `sidecar_spawn_ms`, `health_wait_ms`, `main_navigate_ms`, `shadow_api_spawned_ms`, `total_setup_ms` |

Nitro (when env is set): `startup_timing nitro_sqlite_migrate_ms=…`

## Desktop Local API shadow server (phase 1)

An in-process **Axum** server starts alongside Nitro on a random loopback port. It is **not** user-facing in phase 1 — Nitro still serves all `/api/v1` routes from the WebView.

### Dev note: database path isolation

The shadow server opens its own SQLite file using **Rust-owned migrations** (`src-tauri/migrations/`). Nitro uses Drizzle migrations and a separate file. By default both land in the same Tauri app-data directory under different file names, but their migration ledgers are independent:

| Migrator | File | Ledger table |
|----------|------|--------------|
| Drizzle (Nitro) | `mealprepper.db` (shared default) | `__drizzle_migrations` |
| Rust shadow server | `mealprepper.db` (or `$DATABASE_PATH`) | `_rust_schema_migrations` |

**When switching between migrators** (e.g. resetting schema during development), either:

- Delete / reset your `.data` directory so both migrators start fresh, **or**
- Set `DATABASE_PATH` to point the Rust shadow server at a dedicated file:

  ```powershell
  $env:DATABASE_PATH = "$env:APPDATA\mealprepper-dev\shadow.db"
  bun run desktop:dev:sidecar
  ```

Integration tests always pass an ephemeral `TempDir` so they never share the Drizzle ledger.

### Shadow server health check

```powershell
# Find the port from startup_timing log, then:
curl http://127.0.0.1:<shadow_port>/health
# {"ok":true}
```

### Historical baseline (2026-06-01, pre reorder)

The table below used the **old** milestone order (main created **after** health). Summary field names and segment meanings changed; **do not compare** new `MEALPREPPER_STARTUP_TIMING` lines to these numbers without re-capturing a baseline.

| Run | sidecar_spawn_ms | health_wait_ms | main_create_ms | main_show_ms | total_setup_ms | nitro_sqlite_migrate_ms |
|-----|------------------|----------------|----------------|--------------|----------------|-------------------------|
| 1 | 2737 | 2834 | 352 | 44 | 5968 | — |
| 2 | 1081 | 1069 | 297 | 45 | 2494 | — |
| 3 | 1186 | 1070 | 407 | 57 | 2722 | — |

Captured with `bun run desktop:dev:sidecar`, debug `mealprepper.exe`, after `build:desktop`.

### Capture a new baseline

```powershell
bun run build:desktop
$env:MEALPREPPER_STARTUP_TIMING='1'
$env:MEALPREPPER_CONSOLE='1'   # optional: stderr + pause on fatal error
bun run desktop:dev:sidecar
```

Run **three cold starts** (quit fully between runs). Record the new summary fields (`main_shell_ms`, `sidecar_spawn_ms`, `health_wait_ms`, `main_navigate_ms`, `total_setup_ms`).

Packaged release: set both env vars on `mealprepper.exe` or use `bun run desktop:build:console` for a visible console.

## Bundle analysis

After `bun run build:desktop`:

```powershell
bun scripts/analyze-desktop-bundle.mjs
```

Reports Nitro server entry size, `node_modules` footprint, and largest packages under `src-tauri/resources/nitro/server/node_modules`.

Optional Nuxt bundle analyze (web/server insight):

```powershell
$env:NITRO_ANALYZE='1'
bun run build:desktop:nitro
```

## Before / after (fill when optimizing)

Document Phase 4 changes here with median `health_wait_ms` and `total_setup_ms` from a **new** baseline table.

### Phase 4 notes (initial pass)

- `bun run analyze:desktop-bundle` reports Nitro server footprint after `build:desktop`.
- **Playwright cleanup** — dynamic `import()` on Nitro `close` so Playwright is not loaded at sidecar cold start ([server/plugins/playwright-cleanup.ts](../server/plugins/playwright-cleanup.ts)).
- **Langchain** — already lazy-imported in shopping-list polish handlers; `cheerio` / scrapers load from URL-preview routes only.
- Revisit `nitro.externals.traceInclude` and `cleanNitroPackageCache` only after baselines show bundle size or `health_wait_ms` dominated by Node load rather than migrations.
