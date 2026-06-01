# Desktop startup (profiling, fonts)

Companion to [desktop-development.md](./desktop-development.md) for **packaged / Rust primary API** cold start.

## What runs at launch (phase 2: Rust primary)

1. Tauri `setup_main_window` — generate per-launch UUID token.
2. `shadow_server::start()` — in-process **Axum** server binds on a random loopback port; SQLite migrations run inline.
3. Main WebView — opens `index.html` via `WebviewUrl::App` (served from `frontendDist` by the Tauri internal protocol); `initialization_script` injects `window.__MEALPREPPER_DESKTOP__` with `apiBase` + `token` before the first paint.
4. Poll `GET /health` until 200 (200 ms interval, 60 s timeout). Health check completes **before** the window is created — the Rust API is in-process, so this resolves in milliseconds.
5. Window is shown with `index.html`; `01.desktop-api.client.ts` attaches `token` as `X-Desktop-Token` on all `/api/**` fetches.
6. UI paint — fonts are bundled (no Google CDN).

**No Node/Nitro child process** is spawned. Cold start no longer boots Node.

On setup failure after `"main"` exists, the shell closes `main` before the fatal pause (no separate splash window).

**Dev loop A** (`bun run desktop:dev`): Nuxt on `localhost:3000`, direct `devUrl` main window, **no API server started**.

**Dev loop B / production** (`should_run_sidecar()`): Rust API start → health check → `WebviewUrl::App("index.html")`, as above.

### Shadow-only spawn path

The old shadow-alongside-Nitro spawn path has been removed. There is no dev-only flag to restore it — the Rust API is the sole process. The function `should_run_sidecar()` now gates the Rust primary path (packaged builds or `MEALPREPPER_SIDECAR=1`); the name is preserved to avoid breaking the loop B dev script (`bun scripts/tauri-dev-sidecar.mjs`).

## Startup timing (`MEALPREPPER_STARTUP_TIMING`)

Enable structured milestones in Rust:

| Milestone | Source |
|-----------|--------|
| `setup_begin` | `StartupTiming::begin` |
| `rust_api_spawned` | after `shadow_server::start()` binds and returns port |
| `rust_api_healthy` | after `/health` 200 — near-instant for in-process API |
| `main_window_created` | after main `WebviewWindowBuilder::build` (static `index.html`) |
| `main_window_shown` | after main is visible |
| `main_navigated` | window opened at `index.html` (no explicit navigate call) |
| Summary line | `rust_api_spawn_ms`, `rust_api_health_wait_ms`, `main_shell_ms`, `total_setup_ms` |

## Desktop Local API (Rust primary — phase 2)

The in-process **Axum** server (`src-tauri/src/shadow_server/`) is now the **primary** API. It serves all `/api/v1` routes for Recipe Catalog, Saved Weekplans, and month-plans. Catalog, Saved Weekplans, and month-plans traffic goes to Rust only.

### WebView bootstrap interface

`window.__MEALPREPPER_DESKTOP__` is injected via `initialization_script` with:

```ts
{
  apiBase: "http://127.0.0.1:<port>",  // per-launch loopback
  token: "<uuid>"                       // per-launch auth token
}
```

`app/plugins/01.desktop-api.client.ts` reads both fields and sets the `$fetch` base URL and `X-Desktop-Token` header.

### Database path

The Rust API opens its SQLite file using Rust-owned migrations (`src-tauri/migrations/`, ledger table `_rust_schema_migrations`). Default path is the Tauri app-data directory. Override with:

```powershell
$env:DATABASE_PATH = "$env:APPDATA\mealprepper-dev\rust.db"
bun run desktop:dev:sidecar
```

Integration tests always pass an ephemeral `TempDir`.

### Health check

```powershell
# Find the port from startup_timing log, then:
curl http://127.0.0.1:<port>/health
# {"ok":true}
```

### Capture a startup timing baseline

```powershell
bun run build:desktop
$env:MEALPREPPER_STARTUP_TIMING='1'
$env:MEALPREPPER_CONSOLE='1'   # optional: stderr + pause on fatal error
bun run desktop:dev:sidecar
```

Run **three cold starts** (quit fully between runs). Record summary fields (`rust_api_spawn_ms`, `main_shell_ms`, `rust_api_health_wait_ms`, `main_navigate_ms`, `total_setup_ms`).

Packaged release: set both env vars on `mealprepper.exe` or use `bun run desktop:build:console` for a visible console.

### Phase 2 baseline (fill after first packaged run)

| Run | rust_api_spawn_ms | main_shell_ms | rust_api_health_wait_ms | main_navigate_ms | total_setup_ms |
|-----|-------------------|---------------|-------------------------|------------------|----------------|
| 1 | — | — | — | — | — |
| 2 | — | — | — | — | — |
| 3 | — | — | — | — | — |

> **Phase 1 historical baselines** (Nitro sidecar era) are no longer comparable — milestone names and the entire cold-start path have changed. Do not reference old `sidecar_spawn_ms` / `health_wait_ms` numbers.

## Bundle analysis

After `bun run build:desktop` the static bundle lands in `.output/public/`. Size can be analyzed with:

```powershell
Get-ChildItem -Recurse .output/public | Measure-Object -Property Length -Sum
```

## Offline v1 guarantee (planner-safe cutover)

The Desktop phase-1 cutover guarantees that **happy-path planner workflows never call phase-2 APIs**. Below is the definitive feature map for this release.

### Available offline (phase 1 — Rust primary API)

| Feature | Notes |
|---------|-------|
| **Recipe Catalog** — browse, search, view recipes | Fully local via Rust API |
| **Saved Weekplans** — create, view, edit, delete | Fully local via Rust API |
| **Shopping list — Recipe sections** | Default view; works without any network call |
| **Planner** | All CRUD operations local |

### Explicitly deferred (Desktop backend phase 2)

These features are **gated in the UI** with clear user-facing copy and return `501 desktop.api.not_implemented` when called via the Desktop Local API. They will be enabled when the Rust backend implements the corresponding domain logic.

| Feature | Gated entry point | Deferred API route |
|---------|-------------------|--------------------|
| **Consolidated shopping list** | Shopping list consolidated tab is disabled; `desktopCutoverMessage` shown as tooltip | `POST /api/v1/saved-weekplans/:id/consolidate-shopping-list`, `GET/PUT /api/v1/saved-weekplans/:id/consolidated-shopping-list` |
| **Recipe URL import** | "Import from URL" on add-recipe page hidden when `desktopCutover` | `POST /api/v1/recipes/preview` |
| **AI polish** | AI polish panel gated on `missingApiKey` / `offline` (unchanged) | `POST /api/v1/saved-weekplans/:id/consolidate-shopping-list` with polish options |

### Default view behaviour

`/shopping-list?plan=<id>` without a `view` parameter opens the **sections** tab (recipe-grouped list). The consolidated tab is present but disabled with a tooltip explaining the feature is not yet available on Desktop. Users must explicitly navigate to the consolidated view via `?view=consolidated`; the page no longer auto-switches.
