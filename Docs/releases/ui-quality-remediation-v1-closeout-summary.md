# Internal summary: UI Quality Remediation v1

Release-oriented grouping for reviewers (user stories **20**, **24** in the PRD). Maps 1:1 to PRD implementation modules. No product behavior change beyond quality, accessibility, and consistency on scoped surfaces.

**Score methodology and baseline/post delta:** [Audit closeout](../audits/ui-quality-remediation-v1-audit-closeout.md).

---

## 1. Accessible overlay contract

- Focus trap, restore, Escape, and background blocking standardized via `useAccessibleOverlayInteraction` on priority overlays.
- Tests: `test/component/accessible-overlay-contract.test.ts`.

## 2. Navigation integrity

- Primary navigation targets valid routes only; constants-driven nav set.
- Tests: `test/unit/primary-navigation-integrity.test.ts`.

## 3. State messaging contract

- Shared semantics for validation, import, and save feedback; live region patterns aligned across flows.
- Tests: `test/unit/state-messaging-contract.test.ts`, `test/component/form-flow-status-surfaces.test.ts`.

## 4. Design token compliance

- Semantic roles and forbidden-pattern guardrails for recipe/planner styling.
- Tests: `test/unit/design-token-compliance.test.ts`.

## 5. Touch ergonomics

- Minimum target geometry for dense and icon-first controls on mobile-first paths.
- Tests: `test/unit/touch-ergonomics-contract.test.ts`.

## 6. Visual cost budget

- Elevation and effect tiers to reduce repeated heavy shadows on list/card grids.
- Tests: `test/unit/visual-cost-budget.test.ts`.

## 7. Image loading strategy

- Lazy/async defaults for non-critical list imagery; stable card layout while loading.
- Tests: `test/unit/list-image-loading-strategy.test.ts`, `test/component/list-image-loading-strategy.test.ts`.

## 8. Component vocabulary

- Consolidated primitives (atelier components + vocabulary constants) for cards, chips, and controls.
- Tests: `test/unit/component-vocabulary-contract.test.ts`.

---

## Verification commands

| Command | Purpose |
| --- | --- |
| `bun run test:ui-quality-remediation` | PRD module contract tests only |
| `bun run test run` | Full Vitest regression (unit + integration + component) |

---

## HITL sign-off remainder

Optional final human checks before declaring **10/10** on every module:

1. Keyboard-only pass: open/close each dialog, menu, and filter picker on **Recipe catalog**, **Weekly plan**, **Add recipe**, and **Edit recipe**; confirm focus never lost without intentional dismiss.
2. Screen reader: confirm status/error transitions are announced on save and import failures/successes on add/edit recipe.
3. Mobile device or narrow viewport: confirm no accidental taps on adjacent slot actions after touch target changes.

Record completion in your release checklist or ticket system.
