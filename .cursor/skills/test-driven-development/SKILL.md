---
name: test-driven-development
description: Applies project-specific Test-Driven Development workflow with a dedicated tests folder, focusing on business-value tests, red-green-refactor discipline, and practical test boundaries. Use when implementing features, fixing bugs, or planning test coverage in this repository.
disable-model-invocation: true
---

# Test-Driven Development

## Goal

Use TDD to deliver business behavior safely and quickly. This project uses a dedicated `tests/` folder for all test suites.

## Preconditions (before first test)

Define these first:

1. Business outcome (who benefits and what changes).
2. Acceptance criteria (observable behavior).
3. Test seam (unit, component, integration, or e2e).
4. Minimal failing example (the smallest case that proves behavior).

If any item is missing, ask clarifying questions before writing tests.

## Project Test Layout

Store tests under `tests/` only:

- `tests/unit/` for pure logic, domain rules, utilities.
- `tests/component/` for Vue component behavior/state rendering.
- `tests/integration/` for route/service/repository slices.
- `tests/e2e/` for critical user journeys (if configured).

Do not place `.spec` or `.test` files inside feature source folders unless explicitly requested.

## Core Workflow (Red -> Green -> Refactor)

1. **Red**
   - Write one failing test for one behavior.
   - Fail for the right reason (assert behavior, not internals).
2. **Green**
   - Implement the smallest change to pass.
   - Avoid broad refactors in this step.
3. **Refactor**
   - Improve design while tests stay green.
   - Remove duplication and clarify naming.
4. Repeat per behavior slice.

## Test Value Guardrails

Reject low-value tests:

- Asserting implementation details/private state.
- Snapshot-only tests without behavioral assertions.
- Trivial passthrough/getter tests with no business risk.
- Duplicate coverage of identical behavior at multiple layers.

Prefer high-signal tests:

- Domain invariants and edge cases.
- Error conditions and recovery paths.
- User-visible behavior and API contracts.
- Regression tests for fixed bugs.

## Bug Fix Protocol

For every bug fix:

1. Add a failing test that reproduces the bug in `tests/`.
2. Implement minimal fix.
3. Verify test passes and related suites still pass.

## Naming and Structure Conventions

- Test file names: `<subject>.spec.ts`.
- Test titles: `should <expected behavior> when <condition>`.
- Arrange tests with clear Given/When/Then structure.
- Keep each test focused on one behavior.

## Output Template

When asked to apply TDD, produce:

```md
## TDD Plan
- Behavior to implement:
- Test seam:
- First failing test:
- Minimal implementation strategy:
- Refactor target:

## Files
- tests/...:
- src/...:
```

## Quick Example

```ts
// tests/unit/pricing/calculate-total.spec.ts
import { describe, expect, it } from "vitest";
import { calculateTotal } from "~/utils/pricing/calculate-total";

describe("calculateTotal", () => {
  it("should include tax when region is taxable", () => {
    const total = calculateTotal({ subtotal: 100, taxRate: 0.2, taxable: true });
    expect(total).toBe(120);
  });
});
```
