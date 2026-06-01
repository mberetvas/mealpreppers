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
| 1 | 2737 | 2834 | 352 | 44 | 5968 | — |
| 2 | 1081 | 1069 | 297 | 45 | 2494 | — |
| 3 | 1186 | 1070 | 407 | 57 | 2722 | — |

**Baseline captured:** 2026-06-01, `bun run desktop:dev:sidecar`, debug `mealprepper.exe`, `MEALPREPPER_STARTUP_TIMING=1`, after `build:desktop`.

- **Run 1** was immediately after a full `cargo` rebuild (~37 s compile); sidecar spawn and health wait were ~2.5× runs 2–3 — treat as post-build cold start, not steady state.
- **Runs 2–3 median:** `sidecar_spawn_ms` 1186, `health_wait_ms` 1070, `total_setup_ms` ~2608. Sidecar + health poll dominate; main window create/show under 500 ms combined.
- `nitro_sqlite_migrate_ms` not in console output for these runs; check Nitro stderr if needed (same env flag).

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

### Phase 4 notes (initial pass)

- `bun run analyze:desktop-bundle` reports Nitro server footprint after `build:desktop`.
- **Playwright cleanup** — dynamic `import()` on Nitro `close` so Playwright is not loaded at sidecar cold start ([server/plugins/playwright-cleanup.ts](../server/plugins/playwright-cleanup.ts)).
- **Langchain** — already lazy-imported in shopping-list polish handlers; `cheerio` / scrapers load from URL-preview routes only.
- Revisit `nitro.externals.traceInclude` and `cleanNitroPackageCache` only after baselines show bundle size or `health_wait_ms` dominated by Node load rather than migrations.
