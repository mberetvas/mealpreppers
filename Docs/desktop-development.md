# Desktop development (Tauri)

Mealprepper ships as a **Tauri** desktop app with two local dev loops and a production-like
bundled **Nitro sidecar** path.

Parent plan: [Tauri + SQLite Migration Strategy](./plan/tauri-sqlite-migration-strategy.md).

## Prerequisites (Windows)

1. **Bun** — `bun install` at repo root.
2. **Rust (stable)** — [rustup](https://rustup.rs/).
3. **Microsoft C++ build tools** — **Desktop development with C++** workload.
4. **WebView2** — included on Windows 11; install [Evergreen WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) on Windows 10 if needed.

`@tauri-apps/cli` is a dev dependency; no global `cargo install tauri-cli` required.

## Dev loop A — Nuxt HMR (fast UI)

```powershell
bun install
bun run desktop:dev
```

Runs `tauri dev` → `bun run dev` (Nuxt on `http://localhost:3000`) → Tauri WebView. Uses
local SQLite (`.data/mealprepper.db` by default) and optional `.env` OpenRouter key. No bundled
sidecar or desktop token in this loop.

## Dev loop B — bundled sidecar (integration)

Prepare resources once (Nitro `node-server` build + pinned Node runtime):

```powershell
bun run build:desktop
```

Run Tauri against the sidecar only (no Nuxt dev server):

```powershell
bun run desktop:dev:sidecar
```

Uses `MEALPREPPER_SIDECAR=1` and `src-tauri/tauri.sidecar.conf.json` (skips
`beforeDevCommand`). The shell spawns Nitro on a random `127.0.0.1` port, waits for `GET
/health`, injects `window.__MEALPREPPER_DESKTOP__` (API base + per-launch token), then shows
the window.

## Production-like build

```powershell
bun run desktop:build
# or
bun run desktop:pack
```

`build:desktop` runs `NITRO_PRESET=node-server` Nuxt build into
`src-tauri/resources/nitro/` (in-place; avoids copying junction-heavy `node_modules` on
Windows), downloads Node **22.14.0** into
`src-tauri/resources/node/`, then `tauri build` bundles resources and compiles Rust.

The packaged app:

- Spawns `server/index.mjs` via bundled Node on `127.0.0.1` only.
- Sets `DESKTOP_TOKEN` in the sidecar environment; Nitro middleware enforces
  `X-Desktop-Token` (except `/health`).
- Loads the UI from the sidecar origin (port not baked into static assets).

## Scripts

| Script | Purpose |
|--------|---------|
| `bun run desktop:dev` | Loop A: Nuxt dev + Tauri window |
| `bun run desktop:dev:sidecar` | Loop B: local sidecar + Tauri (run `build:desktop` first) |
| `bun run build:desktop` | Nitro node-server build + resource staging |
| `bun run desktop:build` | Full desktop artifact (`build:desktop` + `tauri build`) |
| `bun run desktop:pack` | Alias for `desktop:build` |

## Layout

| Path | Role |
|------|------|
| `src-tauri/` | Rust shell, `tauri.conf.json`, bundled resources |
| `src-tauri/resources/` | Generated Node + Nitro server (see `resources/README.md`) |
| `server/middleware/00.desktop-token.ts` | Sidecar API token gate |
| `server/routes/health.get.ts` | Sidecar liveness probe |
| `app/plugins/01.desktop-api.client.ts` | Attaches token to localhost `$fetch` |

## Environment

- **Loop A:** `.env` with optional `OPENROUTER_API_KEY` for AI polish (server-only `runtimeConfig`).
  Settings keychain IPC is available in loop A when running inside Tauri.
- **Sidecar / packaged app:** OpenRouter key from OS keychain (Settings) injected at Nitro spawn.
  Optional `DESKTOP_TOKEN` in `.env` when running Nitro standalone for debugging.

## Offline / online feature matrix

| Feature | Offline | Notes |
|---------|---------|-------|
| Recipes CRUD, planner, Saved Weekplans | Yes | SQLite + local images |
| Shopping list (non-AI baseline) | Yes | AI polish shows banner when skipped |
| AI shopping-list polish | No | Requires OpenRouter key + network |
| Recipe URL import | No | UI disabled offline with explicit message |
| Google Fonts / Material Symbols | First paint needs network | CDN in `nuxt.config.ts`; see [desktop-release.md](./desktop-release.md) |

Manual smoke checklist: [desktop-release.md](./desktop-release.md).

## CI

GitHub Actions workflow `.github/workflows/desktop-windows.yml` builds the Windows installer on
`windows-latest` (Bun + Rust). Unsigned artifacts upload by default; Authenticode signing is
optional — see [desktop-signing.md](./desktop-signing.md).

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| `Bundled Node runtime not found` | Run `bun run build:desktop:resources` |
| `Nitro sidecar entry not found` | Run `bun run build:desktop:nitro` then `build:desktop:resources` |
| `glob pattern resources/node/**/*` at compile time | Ensure `src-tauri/resources/node/win-x64/.gitkeep` exists; run `build:desktop` before release build |
| Port 3000 in use (loop A) | Stop other Nuxt instances or align `devUrl` in `tauri.conf.json` |
| 401 on API in sidecar mode | Token missing — confirm `__MEALPREPPER_DESKTOP__` bootstrap and `01.desktop-api.client.ts` |
| MSVC / `link.exe` errors | Install C++ build tools |
