# Mealprepper

Requires **Node.js 22.x** (aligned with the bundled desktop runtime — see `engines.node` in
`package.json`). `bun install` runs a native rebuild of `better-sqlite3` automatically; after
switching Node versions run `bun run rebuild:native`.

```bash
bun install          # deps
bun run dev          # http://localhost:3000
bun run build        # production
bun run preview      # local prod preview
bun run test         # Run tests
```

### Desktop (Tauri spike)

Requires [Rust](https://rustup.rs/) and Windows **C++ build tools** (see
[Docs/desktop-development.md](./Docs/desktop-development.md)).

```bash
bun run desktop:dev          # Nuxt dev server + Tauri window (dev loop A)
bun run build:desktop        # Nitro sidecar + pinned Node resources
bun run desktop:build        # Packaged app with bundled sidecar
```

Libelle recipe URL import uses Playwright (Chromium):

```bash
# one-time local setup
bunx playwright install chromium

# CI/Linux servers (ensures required OS libs are installed)
bunx playwright install --with-deps chromium
```

[Nuxt deployment](https://nuxt.com/docs/getting-started/deployment)

## Server logging

- `LOG_LEVEL` is the server logging source of truth and accepts only `debug`, `info`, `warn`, or `error`.
- If `LOG_LEVEL` is invalid, startup emits one warning to stderr and falls back to `debug` outside `production` or `info` in `production`.
- `LOG_JSON=true` switches server logs to newline-delimited JSON output. Any other value keeps the default pretty console output.
- Request trace IDs resolve in this order: `x-trace-id`, `x-request-id`, generated UUID. The resolved value is stored on request context and echoed back as the `x-trace-id` response header.
- Structured event names must use `domain.action` in snake_case, for example `http.request_handled` or `planning.unexpected_error`.
- Structured payload redaction is centralized and masks these case-insensitive keys before output: `password`, `token`, `secret`, `authorization`, `auth`, `apikey`, `api_key`, `credential`, `credentials`, `ssn`, `credit_card`, `cvv`, `pin`.
- Request diagnostics are emitted only at `debug` level and stay metadata-only by default: method, path, status code, duration, and trace context. Request and response bodies are not logged.
