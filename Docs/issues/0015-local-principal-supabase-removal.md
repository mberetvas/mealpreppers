# Local Planning Principal and Supabase removal

**Type:** AFK  
**Triage:** needs-triage

## Parent

[Tauri + SQLite Migration Strategy](../plan/tauri-sqlite-migration-strategy.md) — Phase 3

## What to build

Replace hosted identity with a **single implicit local user**: stable install-scoped `userId` set on first launch and injected as the **Planning Principal** on every Nitro request (`event.context.planningUserId`). Remove Supabase Auth, anonymous sessions, merge flows, internal purge routes, and related client/server artifacts in one cohesive slice. Delete live `supabase/`, `server/db/supabaseClient.ts`, `@supabase/supabase-js`, and Supabase-only scripts; update **CONTEXT.md**, **README**, and `.env.example` per the plan hygiene checklist.

## Acceptance criteria

- [ ] Nitro middleware resolves a fixed local `{ kind: 'user', userId }` principal; no Bearer or anonymous cookie paths remain
- [ ] Removed: `planningSupabaseAuth`, `usePlanningSupabaseAccessToken`, `anonymous-merge*`, `AnonymousSavedWeekplansHandoffModal`, `server/api/v1/internal/**`, purge services/tests, audit/legacy Supabase scripts
- [ ] `supabase/` directory removed; `docs/archive/supabase-schema/` retained; no `@supabase/supabase-js` in dependencies
- [ ] `.env.example` drops `SUPABASE_*` and purge secrets; documents `DATABASE_PATH` and desktop token dev notes
- [ ] CONTEXT.md no longer describes anonymous idle purge/merge as active product behavior

## Blocked by

- [0014-consolidated-shopping-lists-sqlite](./0014-consolidated-shopping-lists-sqlite.md)
