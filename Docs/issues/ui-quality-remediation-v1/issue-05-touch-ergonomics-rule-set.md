# Issue: Touch ergonomics rule set (mobile-first targets)

## Parent

[PRD: UI Quality Remediation for Recipe and Planning Surfaces](../../prd/PRD-ui-quality-remediation-v1.md)

## What to build

Apply a **touch ergonomics rule set** to high-frequency controls on recipe and planner surfaces: normalize minimum hit areas for icon-only buttons, chips, and destructive actions, with consistent spacing and target geometry for mobile-first use. Align with tokenized spacing where the token layer already exists.

## Acceptance criteria

- [ ] Icon-only and dense controls on scoped mobile planner and recipe editing actions meet the agreed minimum target size (document the minimum target in project docs or code comments when implementing).
- [ ] No regression in existing mobile flows (manual or automated checks on representative viewports).
- [ ] Tests assert minimum interactive target dimensions or hit slop where measurable without brittle DOM coupling, per PRD testing guidance.
- [ ] No API changes.

## Blocked by

None — can start immediately. Prefer implementing after or alongside token compliance on the same components if that reduces rework.

## Type

AFK

## User stories covered

2, 14
