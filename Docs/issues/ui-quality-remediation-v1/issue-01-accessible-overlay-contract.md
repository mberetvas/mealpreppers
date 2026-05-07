# Issue: Accessible overlay contract (dialogs, menus, pickers)

## Parent

[PRD: UI Quality Remediation for Recipe and Planning Surfaces](../../prd/PRD-ui-quality-remediation-v1.md)

## What to build

Introduce a consistent **accessible overlay contract** for dialogs, popovers, filter pickers, and action menus on recipe and planning surfaces. Behavior is standardized end-to-end: focus trap while open, focus restore to the trigger (or a defined successor) on close, Escape closes or dismisses per product rules, and background interaction is blocked so users cannot activate content behind the overlay. Open and closed states and trigger relationships are explicit for assistive technology. Deliver with automated tests that assert keyboard-only flows and focus behavior without coupling to private implementation details.

## Acceptance criteria

- [ ] Dialogs, menus, and filter pickers used on audited recipe/planner paths follow one documented overlay contract (trap, restore, Escape, backdrop/pointer blocking).
- [ ] Filter pickers preserve focus and context when refining results (no focus loss that strands keyboard users).
- [ ] Background content cannot receive clicks or keyboard activation while a modal dialog is open.
- [ ] Vitest (or equivalent) tests cover: keyboard open/close, Escape, focus trap, focus restore after close, and background interaction blocking for at least the priority overlays called out in the PRD.
- [ ] No change to recipe or planning APIs or data models; UI contract only.

## Blocked by

None — can start immediately.

## Type

AFK

## User stories covered

3, 5, 6, 16, 21
