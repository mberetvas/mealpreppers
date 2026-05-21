# Audit 001: Legacy unowned week grid rows

Parent issue: [001-audit-legacy-unowned-week-grid-rows.md](../issues/001-audit-legacy-unowned-week-grid-rows.md)

Rows are `legacy_unowned` when `meal_week_templates.owner_user_id` and `anon_session_id` are both null. They are visible only via deprecated unscoped `/api/v1/planning/week-templates` and hidden from Saved Weekplans (`interpretSavedWeekplanAccess` → 404).

## Tooling

| Artifact | Purpose |
|----------|---------|
| `server/services/planning/auditLegacyUnownedWeekTemplates.ts` | Count + sample ids (service role) |
| `scripts/audit-legacy-unowned-week-templates.ts` | CLI runner per environment |
| `supabase/scripts/purge-legacy-unowned-week-templates.sql` | Delete-as-junk one-off |
| `supabase/scripts/backfill-legacy-unowned-week-template-owner.sql` | Assign user or anon owner one-off |

Run audit (requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`):

```bash
bun --env-file=.env scripts/audit-legacy-unowned-week-templates.ts
```

Staging / production (separate credentials; do not reuse local keys):

```bash
MEALPREPPERS_ENV=staging SUPABASE_URL=<staging-url> SUPABASE_SERVICE_ROLE_KEY=<staging-key> \
  bun scripts/audit-legacy-unowned-week-templates.ts

MEALPREPPERS_ENV=production SUPABASE_URL=<production-url> SUPABASE_SERVICE_ROLE_KEY=<production-key> \
  bun scripts/audit-legacy-unowned-week-templates.ts
```

Paste JSON output into the table below after each run.

## Counts per environment

| Environment | `legacy_unowned` count | Sample ids (up to 10) | Audited at (UTC) | Auditor |
|-------------|------------------------|------------------------|------------------|---------|
| local | _pending HITL run_ | — | — | — |
| staging | _pending HITL run_ | — | — | — |
| production | _pending HITL run_ | — | — | — |

Automated attempt (local, `.env`): 2026-05-21 — script could not reach Supabase (`storage_error`: URL/port). Re-run locally when credentials and network are valid.

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

No new routes or UI were added. Saved Weekplans and legacy week-templates behavior are unchanged. This audit only establishes data state before persistence consolidation.
