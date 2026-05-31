# Planning and Saved Weekplans on SQLite

**Type:** AFK  
**Triage:** needs-triage

## Parent

[Tauri + SQLite Migration Strategy](../plan/tauri-sqlite-migration-strategy.md) — Phase 2 (planning vertical)

## What to build

Extend the SQLite layer and port the **Planning** vertical slice: **Saved Weekplans**, month plans, session/draft planning flows, and related repositories. All `server/api/v1/planning/**` and `server/api/v1/saved-weekplans/**` routes used by the planner UI must persist through Drizzle with stable result types and existing Vitest coverage adapted to SQLite. **Planning Request Context** and structured logging remain unchanged in shape.

## Acceptance criteria

- [ ] Drizzle schema/migrations cover planning and Saved Weekplan tables (additive to recipe schema from prior slice)
- [ ] Saved Weekplan CRUD, month plan APIs, and planner mutations work E2E in desktop sidecar mode with SQLite file under app data (or `DATABASE_PATH` in dev)
- [ ] Repository tests pass without Supabase mocks for planning modules touched in this slice
- [ ] Domain terminology in code and tests uses **Saved Weekplan** (not “Week Template”)

## Blocked by

- [0012-recipe-catalog-sqlite-local-images](./0012-recipe-catalog-sqlite-local-images.md)
