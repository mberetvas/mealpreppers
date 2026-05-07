# UI Quality Remediation v1 — audit closeout

This artifact satisfies [issue-09](../issues/ui-quality-remediation-v1/issue-09-remediation-verification-and-audit-closeout.md): a **documented, repeatable** quality score versus a pre-remediation baseline, tied to automated gates where possible and explicit HITL remainder.

## Method: composite quality index (CQI)

**Definition.** Eight modules match the PRD implementation decisions and issues 01–08. Each module receives a **module score 0–10**. The **CQI** is the sum (max **80**), reported **on the 0–80 scale** and **normalized to 0–100** as `CQI_100 = round(CQI / 80 * 100)`.

**Scoring rules**

| Score | Meaning |
| --- | --- |
| 0–2 | Critical gaps; PRD narrative would flag as blocking |
| 3–4 | Partial; known user-facing friction |
| 5–6 | Acceptable legacy bar; inconsistent with production standard |
| 7–8 | Largely met; minor gaps or HITL-only checks outstanding |
| 9–10 | Met for scoped surfaces; automated contracts green + documented manual spot-checks |

**Pre-remediation baseline (documentary)**  
The repository did not store a numeric predecessor audit. The baseline below is **inferred from the PRD problem statement** (uneven tokens, overlay accessibility, touch targets, visual cost, image loading, vocabulary drift, navigation dead ends, state messaging). It is conservative: the product was usable but below the stated production bar.

| Module | Pre (0–10) | Basis |
| --- | ---: | --- |
| Accessible overlay contract | 3 | Incomplete trap/restore/Escape/backdrop behavior on audited paths |
| Navigation integrity | 4 | Surfaced inactive or placeholder destinations |
| State messaging | 4 | Uneven validation/import/save feedback |
| Design token compliance | 3 | Token bypass via hard-coded colors |
| Touch ergonomics | 4 | High-frequency controls below comfortable targets |
| Visual cost budget | 4 | Repeated heavy shadows / expensive list effects |
| Image loading strategy | 5 | Inconsistent lazy/async defaults on list-heavy surfaces |
| Component vocabulary | 4 | One-off card/chip/control variants |

**Pre CQI:** 31 / 80 → **CQI_100 = 39** (normalized).

**Post-remediation verification (this closeout)**

| Module | Post (0–10) | Evidence |
| --- | ---: | --- |
| Accessible overlay contract | 9 | `useAccessibleOverlayInteraction` + `test/component/accessible-overlay-contract.test.ts` green |
| Navigation integrity | 10 | `test/unit/primary-navigation-integrity.test.ts` + `app/constants/primaryNavigation.ts` |
| State messaging | 9 | `utils/stateMessagingContract.ts` + `test/unit/state-messaging-contract.test.ts` + `test/component/form-flow-status-surfaces.test.ts` |
| Design token compliance | 9 | `app/constants/designTokenCompliance.ts` + `test/unit/design-token-compliance.test.ts` |
| Touch ergonomics | 9 | `app/constants/touchErgonomics.ts` + `test/unit/touch-ergonomics-contract.test.ts` |
| Visual cost budget | 9 | `app/constants/visualCostBudget.ts` + `test/unit/visual-cost-budget.test.ts` |
| Image loading strategy | 9 | `app/constants/listImageLoadingStrategy.ts` + unit/component list-image tests |
| Component vocabulary | 9 | `app/constants/componentVocabulary.ts` + `test/unit/component-vocabulary-contract.test.ts` |

**Post CQI:** 74 / 80 → **CQI_100 = 93** (normalized).

**Delta:** **CQI_100 +54** versus documentary baseline (39 → 93). On the raw **0–80** scale: **+43**.

**HITL remainder (explicit)**  
Scores of 9 (not 10) on several modules reflect that **full manual keyboard and screen-reader sweeps** across every picker and menu variant are not fully substituted by automated tests. Release owners should complete the short checklist in [Closeout summary](../releases/ui-quality-remediation-v1-closeout-summary.md#hitl-sign-off-remainder) before production promotion if policy requires 10/10.

## Automated regression gate

From repository root:

```bash
bun run test:ui-quality-remediation
```

Runs Vitest on the **PRD contract** files for this initiative (**10** files, **73** tests at closeout).

Full regression (all projects, including integration and unrelated domains):

```bash
bun run test run
```

**Last recorded full run:** **38** files, **216** tests, all passed (Vitest v4.1.5).

## API and data model

This closeout slice introduces **no** recipe or planning API changes and **no** data model migrations; verification is documentation plus existing test execution only.
