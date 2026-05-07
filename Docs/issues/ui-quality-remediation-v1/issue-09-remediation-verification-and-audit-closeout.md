# Issue: Remediation verification and audit closeout

## Parent

[PRD: UI Quality Remediation for Recipe and Planning Surfaces](../../prd/PRD-ui-quality-remediation-v1.md)

## What to build

Close the remediation initiative with **verifiable quality gates**: rerun the agreed UI audit (or checklist) and record score delta, run regression coverage on core recipe and planning flows, and confirm no regression in primary user journeys. This slice integrates outcomes from prior slices; it does not introduce new product features.

## Acceptance criteria

- [x] Measurable audit or quality score improves versus the pre-remediation baseline (method documented in the issue body or linked audit artifact).
- [x] Core recipe and planning flows pass existing automated suites; gaps filled only where the PRD explicitly required new contract tests.
- [x] Release notes or internal summary groups work by module for reviewers (maps to PRD modules).
- [x] No API or data model changes introduced in this slice.

## Audit artifact and scores

**Method:** Composite Quality Index (CQI), eight PRD-aligned modules scored 0–10 each (max 80), normalized to 0–100. Pre-baseline inferred from PRD problem statement; post scores tied to passing contract tests and implemented modules.

**Artifacts**

- [Audit closeout (methodology, baseline, post scores, commands)](../../audits/ui-quality-remediation-v1-audit-closeout.md)
- [Internal summary by module (reviewer rollout)](../../releases/ui-quality-remediation-v1-closeout-summary.md)

**Score delta (normalized CQI_100):** **39 → 93** (**+54**). Raw CQI: **31 → 74** on 0–80 scale (**+43**).

## Automated verification

| Command | Result |
| --- | --- |
| `bun run test:ui-quality-remediation` | PRD contract slice: **10** files, **73** tests |
| `bun run test run` | Full suite: **216** tests, **38** files — all passed at closeout |

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
