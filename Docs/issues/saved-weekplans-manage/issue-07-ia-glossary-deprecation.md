# Issue: Navigation, CONTEXT glossary, staged API deprecation

## Parent

[PRD: Saved Weekplans — Manage Page and Planner Lifecycle](../../prd/PRD-saved-weekplans-manage.md)

## What to build

Add **Saved Weekplans** / **Manage plans** (exact label per UX) to primary navigation so the manage page is discoverable—respect existing **primary navigation integrity** tests and update them if routes change.

Update **`CONTEXT.md`** with a **Planning** subsection: **Saved Weekplan**, **Draft week plan**, anonymous merge, purge policy—domain language only, not implementation dumps.

Communicate **staged deprecation** of legacy **`/planning/week-templates`** routes (changelog, code comment, or docs note) without breaking callers until removal ticket exists.

## Acceptance criteria

- [ ] Manage page linked from global/nav surface; navigation contract tests updated if required.
- [ ] CONTEXT glossary extended for Planning terms used in UI and docs.
- [ ] Deprecation note recorded for old API path; Saved Weekplans routes documented as preferred.

## Blocked by

- [Issue 02: Manage page](./issue-02-manage-page-list-actions.md)
- [Issue 03: Planner draft/save/autosave](./issue-03-planner-draft-explicit-save-autosave.md)

## Type

AFK

## User stories covered

27–28
