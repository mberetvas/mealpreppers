---
name: base-technical-spec
description: Applies this project's BASE_TECHNICAL_SPEC.md as the decision baseline for implementation, setup, and reviews. Use when planning work, bootstrapping tooling, evaluating architecture choices, or checking whether changes align with the project specification.
disable-model-invocation: true
---

# Base Technical Spec

## Purpose

Use this skill to keep project work aligned with `BASE_TECHNICAL_SPEC.md` while allowing pragmatic deviations when justified.

## Source of Truth

1. Read `BASE_TECHNICAL_SPEC.md` before making recommendations.
2. Treat it as the default baseline for architecture, tooling, testing, and delivery.
3. If current repository reality differs from the spec, report the gap explicitly.

## Operating Mode (Checklist First)

Always respond with a concise checklist that marks each relevant item:

- `[x] Aligned`
- `[~] Partial`
- `[ ] Missing`
- `[!] Deviation (with rationale required)`

After checklist output, provide:

1. Top 3 highest-impact fixes.
2. Minimal next actions in implementation order.
3. Any approved or proposed deviations with rationale and risk.

## Core Compliance Areas

Check against the spec in this order:

1. **Architecture**
   - Nuxt 3 SPA boundaries.
   - Modular structure and server/api layering.
   - State strategy (local/composable first, global store only when needed).
2. **Tooling**
   - TypeScript, Vitest, shadcn/ui, Tailwind.
   - Lint/format/typecheck and CI expectations.
   - Bun-first workflows when relevant.
3. **Testing**
   - Dedicated `tests/` folder structure.
   - Business-value test focus over test volume.
   - Unit/component/integration balance and smoke e2e coverage.
4. **Documentation and Change Management**
   - Docstrings/comments quality for non-obvious logic.
   - `CHANGELOG.md` significance workflow.
5. **Delivery Plan**
   - Work staged by MVP -> hardening -> v1 milestones.
   - Scope discipline and solo-dev risk controls.

## Deviation Policy (Balanced Strictness)

- Prefer spec-conformant decisions by default.
- Allow deviations when one of these is true:
  - faster delivery with equal/lower risk,
  - clear compatibility or tooling blocker,
  - measurable performance/reliability gain.
- Every deviation must include:
  - what changed,
  - why this is better now,
  - rollback or migration path,
  - impacted spec section(s).

## Output Template

```md
## Spec Compliance Checklist
- [x|~| |!] Area: brief finding

## Highest-Impact Fixes
1. ...
2. ...
3. ...

## Next Actions
1. ...
2. ...
3. ...

## Deviations
- Decision:
- Rationale:
- Risk:
- Rollback/Migration:
- Spec sections impacted:
```

## When To Use

Use this skill when:

- asked to plan or implement features in this repository,
- setting up project tooling and quality gates,
- reviewing architecture or code changes against project standards,
- deciding whether to accept or reject technical deviations.
