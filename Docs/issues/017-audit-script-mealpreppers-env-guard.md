# Add `MEALPREPPERS_ENV` guard to audit script

**Source:** REV-011 (Low) — branch review 2026-05-25
**Type:** AFK

## What to build

Guard `scripts/audit-legacy-unowned-week-templates.ts` against accidental production runs. The script uses `SUPABASE_SERVICE_ROLE_KEY` and will execute against whichever database `.env` points at. Require `MEALPREPPERS_ENV` to be set; if its value is not `local` (or another explicitly allowlisted value), print a visible warning identifying the target environment and exit before any queries are run (or prompt for explicit confirmation, at implementer's discretion). Update the audit runbook in `Docs/audits/001-legacy-unowned-week-grid-rows.md` to include setting `MEALPREPPERS_ENV=local` as a prerequisite step.

## Acceptance criteria

- [ ] Script exits with a clear error message when `MEALPREPPERS_ENV` is unset
- [ ] Script exits (or prompts for confirmation) when `MEALPREPPERS_ENV` is set to a non-`local` value, identifying the environment in the message
- [ ] `Docs/audits/001-legacy-unowned-week-grid-rows.md` checklist mentions `MEALPREPPERS_ENV=local` as a prerequisite before running the audit script

## Blocked by

None — can start immediately.
