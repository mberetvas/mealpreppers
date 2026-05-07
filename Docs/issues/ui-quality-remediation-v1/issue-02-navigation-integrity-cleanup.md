# Issue: Navigation integrity (primary destinations)

## Parent

[PRD: UI Quality Remediation for Recipe and Planning Surfaces](../../prd/PRD-ui-quality-remediation-v1.md)

## What to build

Clean up **navigation integrity** so every affordance surfaced in primary navigation resolves to a valid, intentional destination. Remove or replace placeholder or inactive routes so users never hit dead ends from visible nav. Keep scope to primary navigation contexts only; no large IA restructure beyond the PRD.

## Acceptance criteria

- [ ] All primary navigation entries lead to working screens or documented redirects; no broken or stub-only destinations from primary nav.
- [ ] Automated test (or scripted check) asserts primary nav targets resolve without 404 or empty placeholder for the defined route set.
- [ ] No backend API changes.

## Blocked by

None — can start immediately.

## Type

AFK

## User stories covered

23
