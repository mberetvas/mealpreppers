# Issue: Design token compliance (semantic colors and interaction states)

## Parent

[PRD: UI Quality Remediation for Recipe and Planning Surfaces](../../prd/PRD-ui-quality-remediation-v1.md)

## What to build

Establish a **design token compliance layer** for recipe and planner priority surfaces: replace ad-hoc hex and one-off colors with semantic roles from the existing design system. Interaction states (hover, focus, disabled) and surfaces route through tokenized contracts so future theming stays centralized. Preserve the Culinary Atelier direction; this is an implementation routing change, not a rebrand.

## Acceptance criteria

- [ ] Audited recipe and planner paths do not rely on hard-coded color literals for semantic UI; they consume documented token roles (including focus and disabled).
- [ ] Dark mode (if applicable) remains readable for tokenized components touched in this slice.
- [ ] Tests or lint guardrails catch regressions to direct hard-coded colors on touched components (scope matches PRD testing decisions for token variants).
- [ ] No API or schema changes.

## Blocked by

None — can start immediately.

## Type

AFK

## User stories covered

9, 10, 14, 17, 18
