# Mealprepper

Recipe catalog, weekly meal planning, and shopping lists — packaged as a Nuxt web app and a Tauri desktop app for Windows. Core flows work offline; AI shopping-list polish and recipe URL import need network access.

## Features

- **Recipe catalog** — browse, create, edit, and import recipes (including Libelle URLs via Playwright)
- **Weekly planner** — build meal grids and save them as **Saved Weekplans**
- **Shopping list** — recipe-grouped ingredients for a plan, with optional AI consolidation (OpenRouter)
- **Desktop app** — local SQLite storage, OS keychain for API keys, bundled sidecar for production builds

## Tech stack

| Layer | Stack |
|-------|-------|
| UI | Nuxt 4, Vue 3, Tailwind CSS |
| Server (dev / legacy) | Nitro, better-sqlite3, Drizzle |
| Desktop | Tauri 2, Rust (Axum **Desktop Local API**) |
| Tests | Vitest (unit, component, Nuxt) |

Domain vocabulary and architecture notes live in [CONTEXT.md](./CONTEXT.md).

## Prerequisites

- **Node.js 22.x** — aligned with the bundled desktop runtime (`engines.node` in `package.json`)
- **Bun** — package manager and script runner
- **[just](https://github.com/casey/just)** — task runner for quality checks, local CI, desktop release, and agent automation ([`justfile`](./justfile))
- **Desktop builds** — Rust, Windows C++ build tools, WebView2 ([Docs/desktop-development.md](./Docs/desktop-development.md))

After switching Node versions, rebuild native modules:

```bash
bun run rebuild:native
```

`bun install` runs this automatically via `postinstall`.

## Quick start (web)

```bash
bun install
bun run dev          # http://localhost:3000
```

```bash
bun run build        # production build
bun run preview      # local production preview
bun run test         # Vitest
```

For day-to-day quality and release tasks, prefer the [`justfile`](./justfile) recipes (see below).

Copy [`.env.example`](./.env.example) to `.env` for optional local overrides (data paths, OpenRouter key, logging).

## Justfile

Project tasks are defined in [`justfile`](./justfile). Run `just --list` for the full set.

### Quality

| Recipe | What it does |
|--------|----------------|
| `just lint` | ESLint |
| `just format` | ESLint with `--fix` |
| `just test` | Vitest (all projects) |

### Local CI (mirrors GitHub Actions)

| Recipe | What it does |
|--------|----------------|
| `just ci` | Quality gate from `ci.yml` — frozen install, lint, `cargo fmt`/`clippy`/lib tests, unit + component tests |
| `just ci-desktop` | Full Tauri desktop build (`desktop-windows` workflow) |
| `just ci-rust-integration` | Shadow server integration tests |
| `just ci-full` | `ci` + `ci-desktop` + `ci-rust-integration` |

### Desktop release

| Recipe | What it does |
|--------|----------------|
| `just desktop-build` | Static Nuxt client + packaged Tauri app (`bun run desktop:build`) |
| `just desktop-run` | Run the compiled release binary from `src-tauri/target/release/` |
| `just desktop-run-console` | Same as `desktop-run` with console output enabled |

### Version bumps

| Recipe | What it does |
|--------|----------------|
| `just bump` | Bump patch version in `package.json`, commit, and tag |
| `just bump minor` | Same for minor (also accepts `major`, etc.) |

Uses `bun pm version` under the hood.

### Agent automation (PowerShell)

Requires `agent` or `copilot` on PATH where noted.

| Recipe | What it does |
|--------|----------------|
| `just code-review` | Headless code review via Cursor Agent CLI → `review.md` |
| `just code-review model=opus-4.6` | Override the default model |
| `just cursor-ralph "Docs/issues/my-slice"` | Process issue `.md` files with Cursor Agent CLI |
| `just cursor-ralph-quiet "Docs/issues/my-slice"` | Same, without live progress stream |
| `just copilot-ralph "Docs/issues/my-slice"` | Process issue `.md` files with Copilot CLI |

### OpenRouter (dev)

Set `OPENROUTER_API_KEY` in `.env` when running `bun run dev` or desktop loop A without Tauri. End users configure the key in **Settings** inside the packaged desktop app (OS keychain → sidecar env).

### Libelle recipe import

Recipe URL import uses Playwright (Chromium):

```bash
# one-time local setup
bunx playwright install chromium

# CI/Linux (includes required OS libs)
bunx playwright install --with-deps chromium
```

## Desktop (Tauri)

Requires [Rust](https://rustup.rs/) and Windows **C++ build tools**. See [Docs/desktop-development.md](./Docs/desktop-development.md) for loop A vs loop B, sidecar tokens, and troubleshooting.

```bash
bun run desktop:dev          # Nuxt HMR + Tauri window (loop A)
bun run desktop:dev:sidecar    # static client + Rust API (loop B)
bun run build:desktop          # Nitro sidecar + pinned Node resources
bun run desktop:build          # packaged app with bundled sidecar
```

Related: [desktop-startup.md](./Docs/desktop-startup.md), [desktop-release.md](./Docs/desktop-release.md), [desktop-signing.md](./Docs/desktop-signing.md).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `MEALPREPPER_DATA_DIR` | Root for SQLite DB and recipe images (default: `.data/` in dev) |
| `OPENROUTER_API_KEY` | Shopping-list AI polish (dev; desktop uses keychain) |
| `LOG_LEVEL` | Server log threshold: `debug`, `info`, `warn`, or `error` |
| `LOG_JSON` | `true` for newline-delimited JSON logs |

Full list and defaults: [`.env.example`](./.env.example).

## Server logging

- `LOG_LEVEL` is the source of truth. Invalid values log one stderr warning and fall back to `debug` (non-production) or `info` (production).
- `LOG_JSON=true` switches to JSON output; any other value keeps pretty console output.
- Trace IDs resolve from `x-trace-id`, then `x-request-id`, then a generated UUID; the resolved value is echoed as `x-trace-id`.
- Structured events use `domain.action` in snake_case (e.g. `http.request_handled`).
- Payload redaction masks secrets/PII keys (`password`, `token`, `api_key`, etc.) before output.
- Request diagnostics run at `debug` only (method, path, status, duration, trace) — bodies are not logged.

## Deployment

Web deployment follows standard [Nuxt deployment](https://nuxt.com/docs/getting-started/deployment) guidance. Desktop releases use the Tauri build pipeline above.
