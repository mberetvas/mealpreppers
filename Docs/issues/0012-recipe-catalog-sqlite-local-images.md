# Recipe catalog on SQLite and local recipe images

**Type:** AFK  
**Triage:** needs-triage

## Parent

[Tauri + SQLite Migration Strategy](../plan/tauri-sqlite-migration-strategy.md) — Phase 2 (recipes vertical)

## What to build

Establish **Drizzle + `better-sqlite3`** for the desktop app and port the **Public Recipe Catalog** end-to-end: schema and migrations for recipe-related tables, a shared **db context** behind repositories, startup migration apply (WAL recommended), and replacement of Supabase storage with **local filesystem** images under the app data directory served by Nitro on localhost. Copy `supabase/migrations/` to **`docs/archive/supabase-schema/`** as read-only DDL reference when this slice merges. Recipe CRUD, bulk delete, options, and image upload/validation must work through the sidecar with no Supabase client on these paths.

## Acceptance criteria

- [x] Drizzle schema and `drizzle-kit` migrations exist for recipe domain tables; migrations run before Nitro accepts traffic
- [x] All `server/api/v1/recipes/**` handlers used by the UI read/write SQLite via repositories (no `getSupabaseServerClient` on recipe paths)
- [x] Recipe images are stored under app data `recipe-images/`; upload uses existing validation; stored URLs use localhost Nitro routes
- [x] Vitest repository and API tests pass for recipe flows against a file-backed SQLite test DB
- [x] `docs/archive/supabase-schema/` contains archived PG migrations; live `supabase/` not deleted yet (deferred to identity cleanup slice)

## Blocked by

- [0011-bundled-nitro-sidecar-desktop-token](./0011-bundled-nitro-sidecar-desktop-token.md)
