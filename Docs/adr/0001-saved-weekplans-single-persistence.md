# ADR 0001 — Saved Weekplans single persistence

**Status:** Accepted
**Date:** 2026-05-18

---

## Context

The Planning slice originally exposed two API surfaces for persisted week grids:

1. `/api/v1/planning/week-templates` — an unscoped legacy endpoint with no principal ownership.
2. `/api/v1/saved-weekplans` — the principal-scoped replacement.

Over time, the legacy surface accumulated `legacy_unowned` rows (both `owner_user_id` and `anon_session_id` null) that belong to no Planning Principal. These rows are invisible to the new API and unreachable by any client.

## Decision

The **Saved Weekplan** is the only product concept with a persisted week grid. All persistence and retrieval is principal-scoped through the `planningRepository`.

### Key choices

1. **Single HTTP surface.** Only `/api/v1/saved-weekplans` and its sub-routes are active. The legacy `/api/v1/planning/week-templates` routes were removed (retired May 2026).

2. **Principal-scoped access.** Every read and mutation resolves the current Planning Principal (authenticated user or anonymous session). No unscoped queries exist.

3. **Legacy row audit.** Existing `legacy_unowned` rows require an audit before any destructive action. See `Docs/audits/001-legacy-unowned-week-grid-rows.md` for the audit and migration plan.

4. **Week grid shape.** Each Saved Weekplan `body` contains days `1`–`7` with meal slots holding a recipe-id reference. The planner resolves recipe metadata from the Public Recipe Catalog at render time.

5. **Month plan composition.** A month plan is composed by referencing multiple Saved Weekplans; no separate persistence table exists for the month plan concept.

## Consequences

- Clients use only `/api/v1/saved-weekplans` routes.
- The `planningRepository` enforces principal-scoped queries exclusively.
- `legacy_unowned` rows are invisible to production clients and will be purged after audit completion.
- No migration of legacy rows into the new schema — they are either adopted via manual audit or deleted.
