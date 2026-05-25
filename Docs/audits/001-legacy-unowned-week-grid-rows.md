# Audit 001: Legacy unowned week grid rows

Parent issue: [001-audit-legacy-unowned-week-grid-rows.md](../issues/001-audit-legacy-unowned-week-grid-rows.md)

Rows are `legacy_unowned` when `meal_week_templates.owner_user_id` and `anon_session_id` are both null. Since the deprecated `/api/v1/planning/week-templates` routes were removed (May 2026, [ADR 0001 — Saved Weekplans single persistence](../adr/0001-saved-weekplans-single-persistence.md)), these rows are hidden from the **Saved Weekplans** API (`interpretSavedWeekplanAccess` → 404) and unreachable via any product API. The only recovery path is SQL scripts in `supabase/scripts/`.

## Tooling

| Artifact | Purpose |
|----------|---------|
| `server/services/planning/auditLegacyUnownedWeekTemplates.ts` | Count + sample ids (service role) |
| `scripts/audit-legacy-unowned-week-templates.ts` | CLI runner per environment |
| `supabase/scripts/purge-legacy-unowned-week-templates.sql` | Delete-as-junk one-off |
| `supabase/scripts/backfill-legacy-unowned-week-template-owner.sql` | Assign user or anon owner one-off |

## Prerequisites

1. Set `MEALPREPPERS_ENV=local` — the script will refuse to run if this variable is unset or points to a non-local environment.
2. Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available (via `.env` or exported).

Run audit:

```bash
MEALPREPPERS_ENV=local bun --env-file=.env scripts/audit-legacy-unowned-week-templates.ts
```

Staging / production:

This runner is intentionally **local-only** and will abort for non-`local` `MEALPREPPERS_ENV` values.
For staging/production audits, run the equivalent SQL in the Supabase dashboard (or temporarily extend the allowlist in `scripts/env-guard.ts` with explicit HITL approval).

Paste JSON output into the table below after each run.

## Counts per environment

| Environment | `legacy_unowned` count | Sample ids (up to 10) | Audited at (UTC) | Auditor |
|-------------|------------------------|------------------------|------------------|---------|
| local | _pending HITL run_ | — | — | — |
| staging | _pending HITL run_ | — | — | — |
| production | _pending HITL run_ | — | — | — |

Automated attempt (local, `.env`): 2026-05-21 — script could not reach Supabase (`storage_error`: URL/port). Re-run locally when credentials and network are valid.

## Purge runbook

> [!WARNING]
> **Do not purge until the audit step is complete.** The purge script
> (`supabase/scripts/purge-legacy-unowned-week-templates.sql`) must not run
> until the operator has reviewed the row count. The audit script output is a required prerequisite gate — skipping it risks deleting rows that may need backfill instead.

### Pre-purge checklist

- [ ] Audit script has been executed for the target environment (see commands above)
- [ ] Row count and sample IDs recorded in the "Counts per environment" table
- [ ] Operator has reviewed the audit script output and confirmed rows are junk (not real user data)
- [ ] Decision recorded below as "Delete as junk"

## Decision

**Status:** Pending until all target environments are audited.

| Outcome | When to choose | Follow-up |
|---------|----------------|-----------|
| **Safe to proceed (zero rows)** | Every environment reports count `0` | No migration; unblock issues 002–006 |
| **Backfill** | Rows are real data with known owner | Run `supabase/scripts/backfill-legacy-unowned-week-template-owner.sql` (edit placeholders), re-audit |
| **Delete as junk** | Rows are dev/test noise | Run `supabase/scripts/purge-legacy-unowned-week-templates.sql`, re-audit |

**Default expectation** (architecture grilling, May 2026): dev/local junk only; production should be `0`. Do not keep rows depending on the legacy API.

**Recorded decision:** _Fill after HITL completes all environment runs._

## Acceptance criteria (issue 001)

- [x] Count tooling and migration paths delivered (`auditLegacyUnownedWeekTemplates`, scripts above)
- [ ] Count of `legacy_unowned` rows documented per target environment (table above — HITL)
- [ ] Decision recorded: safe to proceed with zero rows, or migration/backfill completed (or scheduled with explicit owner)
- [x] No new product behavior depends on unscoped access to these rows (audit is ops-only; no HTTP/API changes)

## Product constraint

No new routes or UI were added. The deprecated `/api/v1/planning/week-templates` routes were removed per ADR 0001. `legacy_unowned` rows are now completely hidden from the Saved Weekplans API (404) and the only recovery path is the SQL scripts in `supabase/scripts/`.
