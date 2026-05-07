# Issue: Image loading strategy (lazy list imagery)

## Parent

[PRD: UI Quality Remediation for Recipe and Planning Surfaces](../../prd/PRD-ui-quality-remediation-v1.md)

## What to build

Implement an **image loading strategy** for scroll-heavy recipe and planner lists: lazy or async defaults for non-critical imagery, stable layout while images resolve, and meaningful alt text where images communicate recipe identity. Document defaults so future list surfaces stay fast by default.

## Acceptance criteria

- [ ] Non-critical images in scoped list/card views load lazily or defer until appropriate for the viewport.
- [ ] Cards remain visually stable during image load (no severe layout shift for the defined skeleton or aspect approach).
- [ ] Alt behavior follows the PRD where imagery communicates identity.
- [ ] Tests assert user-visible outcomes (for example deferred loading behavior observable in test harness) rather than private component internals, per PRD testing decisions.
- [ ] Short contributor note (comment or internal doc link) describes list image defaults for future surfaces.

## Blocked by

None — can start immediately.

## Type

AFK

## User stories covered

8, 22
