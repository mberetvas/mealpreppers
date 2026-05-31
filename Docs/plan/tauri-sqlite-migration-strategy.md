# Tauri + SQLite Migration Strategy

Strategy for shipping Mealprepper as a **desktop-only** **Tauri** application with
**SQLite** persistence, replacing the hosted web app and **Supabase** backend.

> **Status:** proposal for implementation. Defines decisions and sequencing. Does not
> change application code until implementation phases land.
>
> **Supersedes:** [electron-migration-strategy.md](./electron-migration-strategy.md)
> (Electron + Supabase preserved).

---

## 1. Objective and scope

**Objective.** Ship Mealprepper as a signed **Windows-first** desktop application using
**Tauri**, a **bundled Nitro sidecar**, and **SQLite**, while keeping the existing Nuxt/Vue
UI and `server/api/v1/**` domain logic wherever possible.

**In scope**

- Tauri shell (Rust): lifecycle, window, OS integration, keychain, child-process supervision.
- Bundled **Nitro `node-server`** sidecar on `127.0.0.1` (same trust model as the Electron plan).
- **Drizzle + `better-sqlite3`** as the sole persistence layer; **local filesystem** recipe images.
- **Single implicit local user** (no Supabase Auth, no anonymous sessions).
- **Settings** UI: OpenRouter API key + app metadata (version, data path, open folder).
- Reproducible **Windows signed installer**; manual updates for v1 (in-app updater later).
- **Core product offline**; network only for optional AI and recipe URL import.

**Out of scope (v1)**

- Hosted web app, Supabase, dual-target sync, or Supabase data import.
- In-app profiles / multi-user on one machine.
- Backup/restore zip, export-all-JSON (Settings phase 2).
- macOS/Linux signed releases (smoke builds OK; GA sequencing after Windows).
- `tauri-plugin-updater` (phase 2 after signing pipeline is stable).
- Internal cron routes (`purge-idle-anonymous`) and anonymous merge flows.

**Success criteria**

- Same feature set as today’s web app for local planning, recipes, Saved Weekplans, shopping lists.
- All privileged secrets stay out of the WebView bundle.
- Fresh install creates DB + app data dirs; core flows work with no network.
- One Windows signed installer artifact from CI (unsigned dev builds before signing lands).

---

## 2. Decision record (grilled)

| Topic | Decision |
|--------|----------|
| Product | **Desktop-only** — retire web/Supabase as product target |
| Shell | **Tauri** (not Electron) |
| App topology | **Bundled Nitro sidecar** — WebView → `http://127.0.0.1:<port>` |
| Identity | **Single implicit local user** — fixed/stable `userId` per install |
| Database | **Drizzle + `better-sqlite3`**; file in OS app data dir |
| Images | **Local filesystem** under app data; Nitro serves HTTP URLs |
| Data migration | **Fresh start** — no Supabase import for v1 |
| AI | **User-owned OpenRouter key** via Settings → keychain → Nitro env; existing `ai_skipped` degradation |
| Updates | **Signed installer, manual update** v1; Tauri updater phase 2 |
| Platforms | **Windows-first**; macOS/Linux signed releases later |
| Offline | **Core product offline**; online-only: AI polish + recipe URL import |
| Node | **Bundle pinned Node** per OS/arch in Tauri resources |
| Local API security | **`127.0.0.1` + per-launch desktop token** header on Nitro |
| Settings UI | **OpenRouter key + app meta** (version, data path, open folder); route **`/settings`** from More |
| Internal routes | **Remove entirely** — purge route, purge secret, anonymous stack |
| Repo hygiene | **Archive** PG migrations → `docs/archive/supabase-schema/`; delete live `supabase/` when SQLite lands; drop audit/legacy scripts |

---

## 3. Current architecture vs target

Derived from the repository (`package.json`, `nuxt.config.ts`, `server/`, `supabase/`).

| Concern | Current (web) | Target (desktop) |
|---------|---------------|------------------|
| Client | Nuxt 4 / Vue 3 | Same UI in Tauri WebView |
| API | Nitro `server/api/v1/**` | Same routes; SQLite repositories |
| Data | Supabase Postgres + Storage | SQLite + local `recipe-images/` |
| Auth | Supabase Bearer + anonymous cookie | Single local `Planning Principal` |
| Secrets | `runtimeConfig` env (service role, OpenRouter, purge) | Keychain → Nitro env; no service role |
| Cron | `POST .../internal/.../purge-idle-anonymous` | **Removed** |
| AI | OpenRouter server-side | Same; key from Settings, not `.env` for end users |
| Deploy | Hosted Nitro + Supabase | Tauri `.msi`/NSIS (Windows v1) |

**Preserved:** vertical slices (Planning, Recipe Catalog, shopping list), **Planning Request
Context**, structured logging, trace IDs, Vitest, Bun for dev/build.

---

## 4. Recommended desktop architecture

**Tauri (Rust) + bundled Nitro sidecar + Nuxt renderer on localhost.**

```
+------------------------------------------------------------------+
| Tauri application (Windows v1)                                    |
|                                                                   |
|  Rust main                                                        |
|   - app lifecycle, window, menus                                  |
|   - spawn/stop bundled Node → Nitro `.output/server/index.mjs`  |
|   - random 127.0.0.1 port; health gate before showing WebView     |
|   - OS keychain: OpenRouter key (+ optional dev overrides)        |
|   - inject env + DESKTOP_TOKEN + DB_PATH at Nitro spawn           |
|   - IPC: open data folder, app version, (future) updater          |
|        |                              ^                           |
|        | child process                | preload / invoke (thin)  |
|        v                              |                           |
|  Nitro sidecar (127.0.0.1:PORT)       WebView (Nuxt client)       |
|   - server/api/v1/** unchanged shape   - $fetch → localhost        |
|   - Drizzle → SQLite                  - X-Desktop-Token on API      |
|   - local recipe-images static/route  - /settings for secrets UX  |
|   - OpenRouter when key + online      - no Supabase in renderer   |
+------------------------------------------------------------------+
```

**Rationale**

- Reuses the **trusted server boundary** from the Electron plan without rewriting handlers in Rust.
- Repository swap (Supabase client → Drizzle) is smaller than `nuxt generate` + Tauri `invoke` for all APIs.
- OpenRouter and file validation stay in TypeScript where they already live.

**Tradeoff:** ships **Rust + Node + Nitro output**; mitigated by Windows-first packaging and pinned Node.

---

## 5. Tauri, Nitro, and process responsibilities

### Rust main (trusted)

- Create window after Nitro health check (`GET` health route or `/api/v1/...` probe).
- Pick free TCP port on `127.0.0.1`; pass port + `DESKTOP_TOKEN` to renderer bootstrap (inline script or first-party config endpoint).
- Spawn bundled Node with Nitro output; pass `DATABASE_URL` / `DATABASE_PATH`, `OPENROUTER_API_KEY` from keychain, `DESKTOP_TOKEN`, paths for images.
- On quit: terminate Nitro child cleanly.
- Expose minimal commands: `open_data_folder`, `get_app_version`, `set_openrouter_key` / `get_openrouter_key` (keychain wrappers).

### Preload / Tauri IPC (minimal)

- Prefer **not** routing app CRUD through Rust; data stays on Nitro.
- Use IPC only for OS affordances Settings needs (folder reveal, version string).

### WebView / Nuxt client (untrusted)

- Existing pages and composables; remove Supabase access token composable.
- API client middleware attaches `X-Desktop-Token` (name TBD) on all `$fetch` to localhost.
- **Settings** at `/settings`, linked from **More** (`app/pages/more.vue`).

### Nitro sidecar (trusted)

- All `server/api/v1/**` handlers.
- **Desktop token middleware:** reject non-health requests without valid per-launch token.
- **SQLite:** single writer; WAL mode recommended; migrations on startup before accepting traffic.
- **Local principal middleware:** set `event.context.planningUserId` to install-scoped local id (replace `resolveSupabaseUserIdFromBearer`).

---

## 6. SQLite, Drizzle, and schema

**Stack:** `drizzle-orm` + `better-sqlite3` + `drizzle-kit` migrations.

**DB location (default):** Tauri `app_data_dir` / `mealprepper.db` (e.g. `%APPDATA%\com.mealprepper\mealprepper.db` on Windows). Optional `DATABASE_PATH` override for dev/tests.

**Schema source**

1. During port: copy existing `supabase/migrations/*.sql` to **`docs/archive/supabase-schema/`** (read-only DDL reference).
2. Author **Drizzle schema** for current domain tables (recipes, Saved Weekplans, month plans, consolidated shopping lists, etc.) — **not** a mechanical copy of RLS/triggers/`service_role` grants.
3. Map `jsonb` → `TEXT` (JSON serialized); UUIDs as `TEXT` or Drizzle UUID helpers; timestamps as ISO `TEXT` or integer ms — pick one convention and stick to it.
4. Drop Postgres-only concepts: RLS, anonymous ownership columns if unused, purge-oriented indexes tied only to anonymous retention.

**Repositories**

- Replace `SupabaseClient` parameters with a thin **db context** (Drizzle instance) behind existing repository modules.
- Keep result types (`storage_error`, etc.) stable where tests depend on them.

**Fresh start:** v1 does not import Supabase production rows.

---

## 7. Recipe images

| Web (today) | Desktop |
|-------------|---------|
| Supabase Storage `recipe-images` bucket | `app_data_dir/recipe-images/{uuid}.{ext}` |
| Public HTTPS URL stored on recipe | `http://127.0.0.1:<port>/...` (Nitro static or dedicated route) |

- Reuse `validateRecipeImageFile` and MIME→ext mapping from `app/utils/recipeImageValidation.ts`.
- `upload-image.post.ts`: write file to disk; return local URL; store path or URL on recipe row.
- CSP `connect-src` / `img-src`: localhost + `data:`; fonts may stay CDN or be bundled later.

**Future (not v1):** optional internal job to delete orphaned image files when a recipe is removed — implement only with a concrete requirement; use desktop token auth if exposed as HTTP.

---

## 8. Identity and removed flows

**Planning Principal (v1):** always `{ kind: 'user', userId: '<install-uuid>' }` created on first launch.

**Remove in one slice**

| Area | Artifacts |
|------|-----------|
| Auth | `planningSupabaseAuth.ts`, `usePlanningSupabaseAccessToken`, Bearer checks |
| Anonymous | session cookies, `anonymous-merge*`, `AnonymousSavedWeekplansHandoffModal` |
| Internal API | `server/api/v1/internal/**`, `savedWeekplansIdlePurgeSecret` |
| Services/tests | `anonymousSavedWeekplansIdlePurge`, purge repository methods, purge/merge tests |
| Ops scripts | `scripts/audit-legacy-unowned-week-templates.ts`, `supabase/scripts/*` |

Update **CONTEXT.md** to remove anonymous idle purge / merge vocabulary for desktop, or mark as web-legacy archived.

---

## 9. Settings UI (`/settings`)

**v1 surface (decision B)**

| Control | Behavior |
|---------|----------|
| OpenRouter API key | Masked input; save/clear; persisted via Tauri keychain; injected into Nitro on spawn |
| Connection hint | Link to OpenRouter; explain AI shopping-list polish is optional |
| App version | Read-only from Tauri package metadata |
| Data directory | Read-only path to SQLite + `recipe-images/` parent |
| Open data folder | Tauri command opens OS file manager |

**Not in v1:** backup/restore zip, export all recipes JSON, theme overrides beyond existing app.

**Dev:** engineers may still use `.env` `OPENROUTER_API_KEY` when running `nuxt dev` without Tauri; document in README.

---

## 10. Security model

**WebView**

- No Node integration in the page; Tauri CSP restricts script and connect targets.
- No Supabase keys, service role, or OpenRouter key in client bundle or `runtimeConfig` public keys.

**Nitro**

- Bind **`127.0.0.1` only**; random port per launch.
- **`DESKTOP_TOKEN`:** generated by Tauri at startup; required header on API routes (except health); timing-safe compare in middleware.
- Renderer receives token only from trusted bootstrap, not hardcoded in built assets.

**Secrets**

| Secret | Storage |
|--------|---------|
| OpenRouter API key | OS keychain via Tauri; optional dev `.env` |
| SQLite path | App data dir; optional env override |
| Desktop token | Ephemeral env per run; not persisted |

**Navigation**

- Deny arbitrary `window.open` / external navigation from WebView; open https links in system browser.
- Pin Tauri and Electron-not-applicable: track Tauri security advisories.

**Fonts (v1 note):** Google Fonts CDN in `nuxt.config.ts` requires network for first paint unless later vendored — acceptable gap for offline *data* guarantee, not offline-first UI polish.

---

## 11. Offline and network-dependent features

| Feature | Offline v1 |
|---------|------------|
| Recipes CRUD | Yes |
| Planner / Saved Weekplans / month plans | Yes |
| Consolidated shopping lists (non-AI path) | Yes |
| Local recipe images | Yes |
| AI shopping-list polish | No — requires key + network; `ai_skipped` when key missing |
| Recipe import from URL / external HTML | No — `fetchRecipePageHtml`, Dagelijkse Kost Firestore, etc. |

UI must show clear **offline** / **no API key** states; reuse existing consolidation `ai_skipped` patterns.

---

## 12. AI (OpenRouter)

- End users configure key in **Settings**; never ship a bundled shared key.
- Nitro reads `openrouterApiKey` from runtime config populated at spawn from keychain.
- Model/timeout/attribution env vars remain server-side defaults in `nuxt.config.ts` (or fixed product defaults).
- LangSmith remains optional dev-only via env if desired.

---

## 13. Packaging, signing, and releases

| Item | v1 | Phase 2 |
|------|-----|---------|
| OS | **Windows** signed installer (NSIS or MSI via Tauri bundler) | macOS notarized + Linux AppImage/deb |
| Updates | Manual download/install | `tauri-plugin-updater` + release feed |
| CI | GitHub Actions `windows-latest` build + sign | Matrix expand |
| Node + Nitro | `extraResources` / bundled sidecar layout | Same pattern per OS |

**Signing:** Authenticode for Windows v1 GA; Apple/Linux credentials not blocking SQLite migration work.

---

## 14. Development workflow

- **Bun** remains package manager and Vitest runner.
- Add `src-tauri/` (or `tauri/`) workspace; scripts: `desktop:dev`, `desktop:build`, `desktop:pack`.
- **Dev loop A:** `nuxt dev` + Tauri window pointed at dev server (fast UI iteration).
- **Dev loop B:** bundled Nitro sidecar + production-like token/DB paths (integration).
- **Local DB:** file under repo `.data/` or env `DATABASE_PATH` when not using Tauri app data dir.
- ESLint: cover Tauri/Rust only as needed; existing app lint unchanged.
- Tests: keep Vitest projects; add Nitro middleware tests for desktop token; smoke test sidecar health + DB migration apply.

**`.env.example` (target shape)**

- Remove `SUPABASE_*`, `SAVED_WEEKPLANS_IDLE_PURGE_SECRET`.
- Add `DATABASE_PATH` (optional), document `DESKTOP_TOKEN` for local sidecar-only dev, OpenRouter notes.
- Keep logging and optional LangSmith vars.

---

## 15. Repo hygiene checklist

Execute when SQLite repositories merge (not before archive copy):

1. Copy `supabase/migrations/` → `docs/archive/supabase-schema/`.
2. Delete `supabase/` (`config.toml`, migrations, scripts).
3. Delete `server/db/supabaseClient.ts`; remove `@supabase/supabase-js` dependency.
4. Delete `scripts/audit-legacy-unowned-week-templates.ts` and related tests if only Supabase-specific.
5. Remove composables and components listed in §8.
6. Update **CONTEXT.md**, **README**, `.env.example`.
7. Add supersede banner on [electron-migration-strategy.md](./electron-migration-strategy.md) (done in repo when this plan lands).

---

## 16. Phased migration plan

| Phase | Milestone | Outcome |
|-------|-----------|---------|
| 0 | Spike | Tauri window loads app against `nuxt dev` OR local Nitro; validates WebView + toolchain |
| 1 | Sidecar | `NITRO_PRESET=node-server` build; bundled Node; health-gated startup; desktop token middleware |
| 2 | SQLite | Drizzle schema + migrations; repository port; archive Supabase SQL; local image upload/serve |
| 3 | Identity & cleanup | Local principal; remove anonymous/merge/purge/internal routes; drop Supabase client |
| 4 | Settings | `/settings` page; keychain OpenRouter; data path + open folder |
| 5 | Windows package | Unsigned then signed installer; CI artifact |
| 6 | Offline UX | Explicit offline/import/AI messaging; CSP tighten for localhost |
| 7 | Phase 2 (later) | macOS/Linux signed builds, `tauri-plugin-updater`, backup/restore if prioritized |

Phases 0–4 can keep a git branch deployable for dogfooding before deleting `supabase/`.

---

## 17. Risks and tradeoffs

| Risk | Mitigation |
|------|------------|
| Two runtimes (Rust + Node) | Windows-first; pinned Node; clear spawn/kill lifecycle |
| Large installer | Accept for v1; later evaluate single-binary Nitro tooling only if painful |
| Schema port errors | Archive PG DDL; repository tests; migrate on startup in dev CI |
| Local port scanning | `127.0.0.1` + per-launch token |
| No backup v1 | Document data path in Settings; add backup in phase 2 if needed |
| Fonts CDN offline | Document; optional vendor fonts later |

---

## 18. Open items (deferred)

- Unix socket / named pipe instead of TCP for Nitro (drop port scanning entirely).
- Orphan recipe-image GC job and whether it needs an `internal/` route.
- Vendoring Google Fonts / Material Symbols for fully offline UI assets.
- Backup/restore format and conflict policy.

---

## 19. References

- Superseded desktop packaging plan: [electron-migration-strategy.md](./electron-migration-strategy.md)
- Domain language: [CONTEXT.md](../../CONTEXT.md)
- Saved Weekplans ADR: [docs/adr/0001-saved-weekplans-single-persistence.md](../../docs/adr/0001-saved-weekplans-single-persistence.md)
