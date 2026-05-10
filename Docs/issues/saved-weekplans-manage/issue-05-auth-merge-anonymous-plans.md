# Issue: Signup/login — merge or discard anonymous Saved Weekplans

## Parent

[PRD: Saved Weekplans — Manage Page and Planner Lifecycle](../../prd/PRD-saved-weekplans-manage.md)

## What to build

When an **anonymous** session holds Saved Weekplans and the user **signs up or logs in**, present a prompt: **move N plans** into the authenticated account or **discard** anonymous data. **Discard** must not retain those rows as anonymous-owned (define as delete or equivalent per privacy expectations).

Implementation depends on **real authentication** being wired (Supabase Auth or chosen stack). Until auth exists, this slice may be **blocked** or implemented behind a feature flag with integration tests using test doubles.

## Acceptance criteria

- [ ] After identity transition, user sees merge prompt when N > 0 anonymous Saved Weekplans exist.
- [ ] **Move** reassigns ownership to the authenticated user and clears anon session linkage appropriately.
- [ ] **Discard** removes or orphan-handles anonymous rows per agreed policy; no silent retention.
- [ ] Automated tests for merge/discard logic using mocked auth and repository.

## Blocked by

- [Issue 01: Ownership schema and Saved Weekplans API](./issue-01-ownership-schema-saved-weekplans-api.md)
- Real authentication integration (project-specific—confirm before scheduling)

## Type

HITL — requires confirmation that auth provider and session bridge match product expectations.

## User stories covered

21
