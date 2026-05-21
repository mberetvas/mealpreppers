# 008 — Saved Weekplan access legacy_unowned comment

**Type:** AFK  
**Labels:** needs-triage  
**User stories:** 20, 21

## Parent

[PRD: Shopping list — pre-release fixes (gate B)](../prd/shopping-list-pre-release-fixes.md)

## What to build

Correct the documentation on the **Saved Weekplan** access classifier so operators and developers are not told that `legacy_unowned` rows (both owner columns null) are exposed via retired week-templates HTTP routes.

The classifier behavior is already correct per ADR 0001 (Saved Weekplans API returns not-found). This slice is comment-only: state 404 on Saved Weekplans and point to the legacy-unowned week grid audit runbook for backfill/purge.

## Acceptance criteria

- [ ] `interpretSavedWeekplanAccess` doc comment no longer references legacy week-templates routes.
- [ ] Comment states legacy rows are hidden from Saved Weekplans (404).
- [ ] Comment references the legacy-unowned audit runbook for backfill/purge (audit 001).
- [ ] No change to runtime access outcomes (`matched`, `legacy_unowned`, `wrong_owner`).

## Blocked by

None — can start immediately (parallel with 006/007).
