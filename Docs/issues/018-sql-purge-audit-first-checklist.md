# SQL purge: enforce "audit first" in ops checklist

**Source:** REV-012 (Low) — branch review 2026-05-25
**Type:** AFK

## What to build

Update `Docs/audits/001-legacy-unowned-week-grid-rows.md` to make the "audit before purge" requirement explicit and prominent. Add a warning block or checklist item at the top of the purge runbook section stating that the purge script must not be run until the audit step is complete and the operator has reviewed the row count. No changes to `supabase/scripts/purge-legacy-unowned-week-templates.sql` itself.

## Acceptance criteria

- [ ] Audit doc has a prominent "audit before purge" warning or checklist item in the purge runbook section
- [ ] The checklist item references the audit script output as a required prerequisite gate before executing the purge
- [ ] No changes to `supabase/scripts/purge-legacy-unowned-week-templates.sql`

## Blocked by

None — can start immediately.

> **Note:** This issue and issue 013 both modify `Docs/audits/001-legacy-unowned-week-grid-rows.md`. Coordinate edits or sequence them to avoid a merge conflict.
