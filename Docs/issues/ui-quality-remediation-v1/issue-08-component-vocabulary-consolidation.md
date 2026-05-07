# Issue: Component vocabulary consolidation (cards, chips, controls)

## Parent

[PRD: UI Quality Remediation for Recipe and Planning Surfaces](../../prd/PRD-ui-quality-remediation-v1.md)

## What to build

Run a **component vocabulary consolidation** pass on recipe and planning workflows: unify repeated card, chip, and control styles into reusable primitives and remove one-off variants that create subtle inconsistencies between add/edit recipe and catalog experiences. Add recipe and edit recipe should feel consistent with the rest of the app without changing core product behavior.

## Acceptance criteria

- [ ] Scoped flows use shared primitives for the consolidated patterns (cards/chips/primary controls) with fewer duplicate style forks.
- [ ] Add and edit recipe surfaces align visually and behaviorally with catalog and planner patterns for the consolidated components.
- [ ] Tests cover tokenized variants or behavior contracts for consolidated components per PRD testing decisions.
- [ ] No recipe or plan API changes.

## Blocked by

[Design token compliance (semantic colors and interaction states)](./issue-04-design-token-compliance-layer.md)

## Type

AFK

## User stories covered

1, 11, 13, 18, 20
