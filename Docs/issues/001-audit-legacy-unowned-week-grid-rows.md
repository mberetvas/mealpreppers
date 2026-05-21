# Audit legacy unowned week grid rows

## Parent

Architecture consolidation: single **Saved Weekplan** persistence module; retire unscoped `/api/v1/planning/week-templates` (see grilling decisions in agent context, May 2026).

## What to build

Before merging persistence and deleting legacy routes, establish what `legacy_unowned` rows exist in `meal_week_templates` (both `owner_user_id` and `anon_session_id` null). These rows are visible only via the deprecated unscoped **week-templates** API and are hidden from **Saved Weekplans** (`interpretSavedWeekplanAccess` → 404).

Deliver an auditable outcome for each environment you care about (local, staging, production): row count, optional sample ids, and a recorded decision (no rows / backfill / delete as junk). If rows exist, include or reference a one-off migration path (SQL or script) to assign ownership or remove them—do not leave them depending on the legacy API.

## Acceptance criteria

- [ ] Count of `legacy_unowned` rows documented per target environment — see [audit report](../audits/001-legacy-unowned-week-grid-rows.md) (HITL: run script per env)
- [ ] Decision recorded: safe to proceed with zero rows, or migration/backfill completed (or scheduled with explicit owner) — same report
- [x] No new product behavior depends on unscoped access to these rows (ops-only audit tooling; no API/UI changes)

## Deliverables

- Audit report: `Docs/audits/001-legacy-unowned-week-grid-rows.md`
- Count/sample: `auditLegacyUnownedWeekTemplates` + `scripts/audit-legacy-unowned-week-templates.ts`
- One-off SQL: `supabase/scripts/purge-legacy-unowned-week-templates.sql`, `backfill-legacy-unowned-week-template-owner.sql`

## Blocked by

None - can start immediately

## Type

HITL

## Triage

`needs-triage`
