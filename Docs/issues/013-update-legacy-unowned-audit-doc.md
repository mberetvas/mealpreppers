# Update legacy-unowned audit doc for removed routes

**Source:** REV-006 (Low) — branch review 2026-05-25
**Type:** AFK

## What to build

Update `Docs/audits/001-legacy-unowned-week-grid-rows.md` to reflect the current state after ADR 0001: the deprecated `/api/v1/planning/week-templates` routes were removed (May 2026). `legacy_unowned` rows are now unreachable via any product API — `/api/v1/saved-weekplans` returns 404 for them via `interpretSavedWeekplanAccess`. The only recovery path is SQL scripts.

## Acceptance criteria

- [ ] Audit doc no longer states that `legacy_unowned` rows are "visible via deprecated week-templates routes"
- [ ] Audit doc states that `legacy_unowned` rows are hidden from the **Saved Weekplans** API (404) since the routes were removed
- [ ] Audit doc identifies the SQL scripts (`supabase/scripts/`) as the only recovery path
- [ ] A cross-reference to ADR 0001 is present in the affected section

## Blocked by

None — can start immediately.
