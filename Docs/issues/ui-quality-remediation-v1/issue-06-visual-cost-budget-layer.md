# Issue: Visual cost budget (elevation and repeated effects)

## Parent

[PRD: UI Quality Remediation for Recipe and Planning Surfaces](../../prd/PRD-ui-quality-remediation-v1.md)

## What to build

Introduce a **visual cost budget** for repeated list and card UI: reduce repeated heavy shadows and expensive compositing on scroll-heavy grids while preserving hierarchy through tonal layering and a small set of elevation tiers. Motion and elevation feel purposeful and lightweight; respect reduced-motion preferences for optional animations.

## Acceptance criteria

- [ ] List and card grids on scoped recipe/planner surfaces avoid redundant heavy shadows or stacked expensive effects documented as problematic in the audit.
- [ ] Hierarchy remains clear at a glance (tonal or limited elevation tiers), including legibility at small card sizes.
- [ ] Reduced-motion mode minimizes non-essential movement on optional animations in touched surfaces.
- [ ] User-outcome oriented check: scrolling representative lists remains smooth on a mid-range device profile (manual smoke or agreed lightweight benchmark); no new telemetry product required.
- [ ] Builds on semantic tokens for surfaces touched in the token compliance slice.

## Blocked by

[Design token compliance (semantic colors and interaction states)](./issue-04-design-token-compliance-layer.md)

## Type

AFK

## User stories covered

7, 12, 13, 15, 19
