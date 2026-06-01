# Desktop startup (profiling, splash, fonts)

Companion to [desktop-development.md](./desktop-development.md) for **packaged / sidecar** cold start.

## What runs at launch

1. Tauri `setup_app` — optional splash window (sidecar mode only).
2. Bundled Node + Nitro `server/index.mjs` — SQLite migrations in `00.sqlite-migrate` plugin.
3. Poll `GET /health` until 200 (200 ms interval, 60 s timeout).
4. Main WebView (hidden until healthy) + `window.__MEALPREPPER_DESKTOP__` bootstrap.
5. UI paint — fonts are bundled (no Google CDN).

**Dev loop A** (`bun run desktop:dev`): Nuxt on `localhost:3000`, **no splash**, **no sidecar timing env**.

**Dev loop B / production** (`should_run_sidecar()`): splash + sidecar path below.

## Startup timing (`MEALPREPPER_STARTUP_TIMING`)

Enable structured milestones in Rust and Nitro:

| Milestone | Source |
|-----------|--------|
| `setup_begin` | `StartupTiming::begin` |
| `sidecar_spawned` | after Nitro `Command::spawn` |
| `sidecar_healthy` | after `/health` 200 |
| `main_window_created` | after main `WebviewWindowBuilder::build` |
| `main_window_shown` | after `main.show()` |
| Summary line | `sidecar_spawn_ms`, `health_wait_ms`, `main_create_ms`, `main_show_ms`, `total_setup_ms` |

Nitro (when env is set): `startup_timing nitro_sqlite_migrate_ms=…`

### Capture a baseline (before bundle changes)

```powershell
bun run build:desktop
$env:MEALPREPPER_STARTUP_TIMING='1'
$env:MEALPREPPER_CONSOLE='1'   # optional: stderr + pause on fatal error
bun run desktop:dev:sidecar
```

Run **three cold starts** (quit app fully between runs). Record summary lines:

| Run | sidecar_spawn_ms | health_wait_ms | main_create_ms | main_show_ms | total_setup_ms | nitro_sqlite_migrate_ms |
|-----|------------------|----------------|----------------|--------------|----------------|-------------------------|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |

Packaged release: set both env vars on `mealprepper.exe` or use `bun run desktop:build:console` for a visible console.

## Splash window

Shown only when `should_run_sidecar()` is true (packaged app or `MEALPREPPER_SIDECAR=1` loop B). Static page: `src-tauri/assets/splash.html`. Closed after main window `show()` on success; closed on setup failure before fatal pause.

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

Document Phase 4 changes here with median `health_wait_ms` and `total_setup_ms` from the table above.
