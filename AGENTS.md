# Agent instructions (Mealprepper)

## Instruction priority

When guidance conflicts, resolve in this order:

1. The user's current message
2. User rules (Cursor settings)
3. This file (`AGENTS.md`)
4. `.cursor/rules/karpathy-guidelines.mdc`

## Sources of truth

| Topic | Where to look |
| :--- | :--- |
| Domain language (Planning, Recipe Catalog, logging) | [`CONTEXT.md`](CONTEXT.md) |
| Architecture decisions | [`Docs/adr/`](Docs/adr/) |
| Scripts and test projects | [`package.json`](package.json) |
| Desktop build and Nitro bundling | [`Docs/desktop-startup.md`](Docs/desktop-startup.md) |

Do not invent synonyms for terms defined in `CONTEXT.md`.

## Stack (read before assuming cloud flows)

- **App**: Nuxt 3, Vue 3, TypeScript, Tailwind, Vitest
- **Desktop**: Tauri sidecar; local SQLite (`better-sqlite3`) via Drizzle; one **Planning Principal** per install (`local-user-id`), not anonymous session cookies
- **Optional / dev**: Supabase and PostgreSQL may appear in docs or migrations; default runtime paths are install-scoped SQLite and Nitro APIs under `server/`
- **Slices**: Feature code under `server/services/` (e.g. `planning/`, `recipe-catalog/`, `recipe-ingestion/`, `shopping-list/`); thin handlers in `server/api/`

## Tone and code style

- **Compact and technical**: Direct answers; no filler or sycophantic praise
- **Self-documenting code**: Intention-revealing names; strict TypeScript (no `any`)
- **Comments**: Doc comments on exported domain APIs and non-obvious invariants only — not on every helper

## Before code changes

Skip this section for pure Q&A, reviews, or docs-only questions unless the user asks for implementation.

1. **Scope**: List files to touch (or name what you must read first)
2. **Success**: One sentence describing done
3. **Verify**: Vitest command(s) from `package.json` you will run (targeted project when possible)
4. **Terms**: Check naming against `CONTEXT.md` (e.g. **Saved Weekplan**, not "week template")

## Non-negotiables

### Commands

- Prefer **Bun** (`bun`) for installs and workspace scripts
- Exception: `package.json` scripts that explicitly call `npm` (e.g. `rebuild:native` for `better-sqlite3`)

### Nuxt `server/utils/`

- Never re-export helpers already exported elsewhere (e.g. do not re-export `redact` from `structuredLogger.ts` when `redaction.ts` exports it) — duplicate exports break auto-import

### Planning handlers

- Use **Planning Request Context** (`server/services/planning/planningRequestContext.ts`) for logger, principal, and trace ID
- Do not pass trace IDs manually through deep call chains when request-scoped context exists

### HTTP and routes

| Do | Don't |
| :--- | :--- |
| `GET` / `POST` `/api/v1/saved-weekplans`, `GET` / `PATCH` / `DELETE` `/api/v1/saved-weekplans/:id` | Legacy `/api/v1/planning/week-templates` (retired) |
| Product copy and code names: **Saved Weekplan** | "Week template" as the product term |

### Logging

Follow **Application Logger** and vocabulary in [`CONTEXT.md`](CONTEXT.md) (Logging section): log levels, **Log Event Name** (`domain.action`), trace via request context, **Log Redaction** for secrets and PII

### Git

- Do not commit or push unless the user asks
- Do not commit generated desktop bundles under `src-tauri/resources/nitro/` unless the task is explicitly a desktop release build

## Testing

- **New domain behavior or bug fixes**: Test-driven development (red → green → refactor); cover happy path and meaningful boundaries
- **Trivial edits** (typos, single-line fixes, comment-only): Run only relevant Vitest targets if they exist; do not run the full suite by default
- Use Vitest projects from `package.json` (`test:unit`, `test:component`, `test:nuxt`, etc.) — pick the smallest set that exercises your change

## Architecture (operational)

- Extend the **existing vertical slice** (Planning, Recipe Catalog, Recipe Ingestion, Navigation) instead of new cross-slice imports without reading current boundaries
- Keep `server/api/` and pages thin; put rules and orchestration in `server/services/<slice>/`
- Consolidate validation, error codes, and hydration policy per domain — do not duplicate policy in handlers
- Before changing persistence or auth shape, read `CONTEXT.md` Planning section and any ADR in [`Docs/adr/`](Docs/adr/)

## Do's and Don'ts

| Do | Don't |
| :--- | :--- |
| Use Planning Request Context in planning handlers | Hand-roll logging or manual trace-ID threading |
| Use `bun` for package and script runs | Use `npm install` / `pnpm` / `yarn` unless a script requires otherwise |
| Add Vitest coverage for new behavior and regressions | Skip tests for non-trivial logic; defer tests until after large unverified integration |
| Check `server/utils/` for duplicate exports before adding helpers | Re-export core utils from wrapper modules |
| Read `CONTEXT.md` for canonical terms | Paraphrase domain terms or revive retired API paths |
