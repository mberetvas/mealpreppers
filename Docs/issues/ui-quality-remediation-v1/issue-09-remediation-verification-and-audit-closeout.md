# Issue: Remediation verification and audit closeout

## Parent

[PRD: UI Quality Remediation for Recipe and Planning Surfaces](../../prd/PRD-ui-quality-remediation-v1.md)

## What to build

Close the remediation initiative with **verifiable quality gates**: rerun the agreed UI audit (or checklist) and record score delta, run regression coverage on core recipe and planning flows, and confirm no regression in primary user journeys. This slice integrates outcomes from prior slices; it does not introduce new product features.

## Acceptance criteria

- [ ] Measurable audit or quality score improves versus the pre-remediation baseline (method documented in the issue body or linked audit artifact).
- [ ] Core recipe and planning flows pass existing automated suites; gaps filled only where the PRD explicitly required new contract tests.
- [ ] Release notes or internal summary groups work by module for reviewers (maps to PRD modules).
- [ ] No API or data model changes introduced in this slice.

## Blocked by

[Accessible overlay contract (dialogs, menus, pickers)](./issue-01-accessible-overlay-contract.md)  
[Navigation integrity (primary destinations)](./issue-02-navigation-integrity-cleanup.md)  
[State messaging contract (validation, import, save)](./issue-03-state-messaging-contract.md)  
[Design token compliance (semantic colors and interaction states)](./issue-04-design-token-compliance-layer.md)  
[Touch ergonomics rule set (mobile-first targets)](./issue-05-touch-ergonomics-rule-set.md)  
[Visual cost budget (elevation and repeated effects)](./issue-06-visual-cost-budget-layer.md)  
[Image loading strategy (lazy list imagery)](./issue-07-image-loading-strategy-module.md)  
[Component vocabulary consolidation (cards, chips, controls)](./issue-08-component-vocabulary-consolidation.md)

## Type

HITL (human sign-off on audit interpretation and release readiness) with AFK automation prep where possible

## User stories covered

20, 24
