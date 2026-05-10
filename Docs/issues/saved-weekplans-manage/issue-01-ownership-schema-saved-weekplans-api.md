# Issue: Ownership schema, session principal, and Saved Weekplans API

## Parent

[PRD: Saved Weekplans — Manage Page and Planner Lifecycle](../../prd/PRD-saved-weekplans-manage.md)

## What to build

Introduce **ownership** for persisted weekly grids so each row belongs to either an **authenticated User** (when auth exists) or an **anonymous session** carried by a stable server-issued cookie or equivalent. Ship a **Supabase migration** adding the necessary columns (and indexes), **RLS or application-level filtering** consistent with how the app talks to Supabase today, and **new HTTP routes** under the Saved Weekplans vocabulary (e.g. list, get by id, create, patch, delete) that delegate to the existing planning persistence logic while enforcing **only the current principal** can see or mutate their rows.

Legacy **`/api/v1/planning/week-templates`** routes remain callable with unchanged behavior until consumers migrate (PRD regression story). Emit **structured logs** for mutations using existing planning log patterns—no secrets or PII in payloads.

Verification is **automated**: unit tests for repository scoping and handler contracts (success, not found, forbidden cross-owner), aligned with existing planning error and validation tests.

## Acceptance criteria

- [ ] Migration adds ownership fields compatible with both anonymous sessions and future `user_id`; existing rows get a defined migration strategy (e.g. nullable owner + backfill rule documented in PR/issue body).
- [ ] Server resolves **current principal** on each planning mutation/list request and filters **list/get/patch/delete** accordingly.
- [ ] **Saved Weekplans** routes exist and implement **GET collection**, **GET by id**, **POST create**, **PATCH update**, **DELETE** with `WeekPlanV1` validation and existing recipe-id existence rules where applicable.
- [ ] Legacy week-template routes still work for unchanged callers (compat smoke or test).
- [ ] Automated tests cover happy paths and **cross-owner denial** for at least one mutating operation.

## Blocked by

None — can start immediately.

## Type

AFK

## User stories covered

20, 22, 23 (schema/policy foundation), 26, 28, 29
