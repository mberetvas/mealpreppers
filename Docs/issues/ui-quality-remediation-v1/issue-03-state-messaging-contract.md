# Issue: State messaging contract (validation, import, save)

## Parent

[PRD: UI Quality Remediation for Recipe and Planning Surfaces](../../prd/PRD-ui-quality-remediation-v1.md)

## What to build

Implement a **state messaging contract** for dynamic outcomes on recipe create/edit and related flows: validation errors, warnings, import results, and save feedback. Status changes are both visible and announced appropriately for assistive technology. Copy and announcement semantics are aligned so keyboard and screen reader users understand what happened after each action.

## Acceptance criteria

- [x] Error, warning, and success transitions on scoped flows use consistent live-region or equivalent announcement behavior per the contract.
- [x] Messages remain understandable when navigating by keyboard and when using a screen reader (no silent-only color changes for critical state).
- [x] Tests assert externally observable behavior: visibility and/or announcement hooks for representative success and failure paths (not snapshot-only of markup).
- [x] No recipe/plan API changes.

## Blocked by

None — can start immediately. Coordinate with overlay work where messages appear inside dialogs so focus and announcements do not fight.

## Type

AFK

## User stories covered

4, 18
