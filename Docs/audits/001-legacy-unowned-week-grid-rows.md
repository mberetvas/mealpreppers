# Audit 001 — Legacy unowned week grid rows

**Created:** 2026-05-18
**Related:** [ADR 0001 — Saved Weekplans single persistence](../../docs/adr/0001-saved-weekplans-single-persistence.md)

---

## Summary

After the `/api/v1/planning/week-templates` routes were removed (ADR 0001, `0001-saved-weekplans-single-persistence`), `legacy_unowned` rows in `meal_week_templates` are hidden from the Saved Weekplans API. Clients receive 404 for any attempt to access these rows because they have no `owner_user_id` and no `anon_session_id`.

The only recovery path for these rows is via the SQL scripts in `supabase/scripts/`. No product UI or API endpoint can surface them.

## Current state

- Rows with both ownership columns null are classified `legacy_unowned`.
- These rows are hidden from the Saved Weekplans API (returns 404) since the legacy routes were removed.
- No client can read, update, or delete them through the application.

## Recovery

The only recovery path is manual database intervention using `supabase/scripts/` SQL scripts (e.g., `purge-legacy-unowned-week-templates.sql` or a future adoption script).

## Purge Runbook

> [!WARNING]
> The purge must not run until the audit step is complete. Do not purge until audit output has been reviewed and the row count confirmed.

### Prerequisites

1. Set `MEALPREPPERS_ENV=local` before running any audit or purge script (the environment guard will reject execution otherwise).
2. Run the audit query to obtain the current row count:
   ```sql
   SELECT count(*) FROM public.meal_week_templates
   WHERE owner_user_id IS NULL AND anon_session_id IS NULL;
   ```
2. The audit script output is a prerequisite gate — row count review before purge execution is mandatory.
3. Record the count and review whether any rows should be adopted rather than deleted.

### Execution

Only after the audit step is complete and the operator has confirmed the row count:

```sql
-- supabase/scripts/purge-legacy-unowned-week-templates.sql
DELETE FROM public.meal_week_templates
WHERE owner_user_id IS NULL AND anon_session_id IS NULL;
```

## Cross-references

- ADR 0001: `0001-saved-weekplans-single-persistence`
- Purge script: `supabase/scripts/purge-legacy-unowned-week-templates.sql`
