# Issue: Purge inactive anonymous Saved Weekplans (~90 days)

## Parent

[PRD: Saved Weekplans — Manage Page and Planner Lifecycle](../../prd/PRD-saved-weekplans-manage.md)

## What to build

Run a **scheduled or periodic job** (cron, Supabase scheduled function, or CI-triggered batch—match ops constraints) that **deletes** Saved Weekplans that remain **anonymous-owned** and whose **`updated_at`** is older than approximately **90 days**. Do **not** delete rows already attached to an authenticated user.

Emit structured logs/metrics for purge runs without PII. Document idle definition as **`updated_at`** per PRD.

## Acceptance criteria

- [ ] Job selects only anonymous-owned eligible rows by the agreed cutoff.
- [ ] User-owned rows are never selected by this job.
- [ ] Logs use stable **Log Event Name** patterns; no secrets or PII.
- [ ] Tests verify selection logic with fixture timestamps and ownership flags.

## Blocked by

- [Issue 01: Ownership schema and Saved Weekplans API](./issue-01-ownership-schema-saved-weekplans-api.md)

## Type

AFK

## User stories covered

22–23
