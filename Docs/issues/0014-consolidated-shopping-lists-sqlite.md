# Consolidated shopping lists on SQLite

**Type:** AFK  
**Triage:** needs-triage

## Parent

[Tauri + SQLite Migration Strategy](../plan/tauri-sqlite-migration-strategy.md) — Phase 2 (shopping vertical)

## What to build

Port **consolidated shopping list** persistence and APIs to SQLite so shopping-list flows work offline with the rest of the desktop product. Includes consolidation endpoints, list status, and repository modules currently backed by Supabase. Preserve existing **`ai_skipped`** degradation behavior when OpenRouter is unavailable (key injection comes in Settings slice).

## Acceptance criteria

- [ ] Drizzle schema/migrations cover consolidated shopping list tables
- [ ] Shopping list and consolidation API routes work E2E in desktop sidecar mode without Supabase
- [ ] Vitest coverage for consolidation and list repositories passes against SQLite
- [ ] Non-AI consolidation path works with no network; AI polish remains optional and degrades gracefully without a key

## Blocked by

- [0013-planning-saved-weekplans-sqlite](./0013-planning-saved-weekplans-sqlite.md)
