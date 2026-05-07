# PRD: UI Quality Remediation for Recipe and Planning Surfaces

## Problem Statement

Mealprepper's core product surfaces, especially Recipe Catalog, Add Recipe, Edit Recipe, and planner overlays, currently show uneven technical quality. The recent audit identified token bypass via hard-coded colors, incomplete accessibility behavior in dialogs and menus, touch-target misses on mobile-heavy controls, repeated expensive visual effects, and inconsistent image loading strategy. This creates friction for keyboard and assistive technology users, increases maintenance cost of theming, and weakens performance on list-heavy screens where families plan meals under time pressure.

## Solution

Deliver a focused remediation pass that keeps the current Culinary Atelier product direction while raising technical execution to a consistent production standard. The work standardizes semantic design token usage, hardens accessibility behavior for overlays and interactive controls, improves mobile ergonomics, reduces avoidable rendering cost, and consolidates component vocabulary across recipe and planning workflows. The target outcome is a higher audit score and a calmer, more reliable planning flow without changing core product behavior.

## User Stories

1. As a household planner, I want add and edit recipe screens to feel consistent with the rest of the app, so that planning feels predictable.
2. As a mobile user in the kitchen, I want all high-frequency controls to have comfortable hit areas, so that I can avoid accidental taps.
3. As a keyboard user, I want to fully operate dialogs, menus, and pickers without a mouse, so that I can complete planning tasks efficiently.
4. As a screen reader user, I want status and error changes announced automatically, so that I can understand what happened after each action.
5. As a recipe curator, I want filter pickers to preserve focus and context, so that I do not lose my place while refining results.
6. As a meal planner, I want modal interactions to block background interaction safely, so that I do not trigger unintended actions.
7. As a user on a mid-range phone, I want recipe and planner views to stay smooth while scrolling, so that I can browse quickly.
8. As a user on limited data, I want off-screen images to load lazily, so that pages open faster.
9. As a user switching themes in the future, I want visual colors to adapt automatically, so that readability remains strong.
10. As a maintainer, I want semantic token usage instead of ad-hoc hex values, so that styling changes are safe and centralized.
11. As a maintainer, I want a stable component vocabulary for cards, chips, and controls, so that new UI work does not drift.
12. As a designer-developer, I want elevation and motion patterns to be purposeful and lightweight, so that interfaces feel intentional instead of generic.
13. As a planner managing many recipes, I want list and card interfaces to remain legible at small sizes, so that I can scan quickly.
14. As a user with low vision, I want clear focus states on all interactive elements, so that navigation is obvious.
15. As a user in reduced-motion mode, I want optional animations to minimize movement, so that the app remains comfortable.
16. As a QA engineer, I want behavioral tests around overlay accessibility contracts, so that regressions are caught before release.
17. As a QA engineer, I want tests for tokenized component variants, so that visual system regressions are caught early.
18. As a product engineer, I want to preserve existing recipe and plan APIs while improving UI quality, so that feature velocity is not blocked.
19. As an operator, I want performance-sensitive paths to avoid avoidable paint and composite cost, so that device variability has lower impact.
20. As a release owner, I want the remediation work grouped into clear modules, so that review and rollout are safe.
21. As a future contributor, I want explicit standards for dialogs, menus, and picker interactions, so that new components follow the same contract.
22. As a future contributor, I want image rendering defaults documented, so that list-heavy surfaces remain fast by default.
23. As a user, I want no broken primary navigation destinations, so that I trust every visible route affordance.
24. As a product team member, I want a measurable quality score improvement after remediation, so that we can confirm impact.

## Implementation Decisions

- Build a **Design Token Compliance Layer** that consolidates semantic color, elevation, and interaction states for recipe and planner surfaces.
  - Replace hard-coded values with semantic roles derived from the existing design system.
  - Keep the Culinary Atelier aesthetic but route implementation through tokenized contracts.

- Build an **Accessible Overlay Contract Module** for dialogs, popovers, filter pickers, and action menus.
  - Standardize focus trap, focus restore, escape handling, and background interaction locking.
  - Require explicit state semantics for open/closed and trigger relationships.

- Build a **Touch Ergonomics Rule Set** for mobile-first controls.
  - Normalize minimum hit area for icon buttons, chip controls, and destructive actions.
  - Use consistent spacing and target geometry for high-frequency interactions.

- Build a **Visual Cost Budget Layer** for repeated components.
  - Reduce repeated heavy shadows and expensive effects in list and card grids.
  - Preserve hierarchy via tonal layering and limited elevation tiers.

- Build an **Image Loading Strategy Module** for scroll-heavy recipe and planner lists.
  - Introduce lazy and async loading defaults for non-critical imagery.
  - Keep meaningful alt behavior where imagery communicates recipe identity.

- Build a **State Messaging Contract** for dynamic validation, import, and save outcomes.
  - Standardize live status behavior for error, warning, and success transitions.
  - Align copy and announcement semantics across recipe create/edit flows.

- Build a **Component Vocabulary Consolidation** pass.
  - Unify repeated card/chip/button styles into reusable primitives.
  - Reduce one-off variants that create subtle trust-breaking differences.

- Build a **Navigation Integrity Cleanup** for surfaced but inactive destinations.
  - Remove or replace placeholder destinations from primary navigation contexts.

## Testing Decisions

- A good test validates externally observable behavior, not internal implementation details.
- A good test for UI quality asserts contracts users can feel: keyboard reachability, focus movement, live announcements, target size, route behavior, and visible state transitions.
- A good performance-oriented test checks rendering and loading behavior by user outcomes (for example deferred image loading), not by private component internals.

- Modules to test:
  - **Accessible Overlay Contract Module**
    - Keyboard-only open, close, and escape flows.
    - Focus trap and focus restore after close.
    - Background interaction blocking while open.
  - **Touch Ergonomics Rule Set**
    - Minimum target sizes for icon-only and dense controls.
    - No regression for mobile planner and recipe editing actions.
  - **Design Token Compliance Layer**
    - Visual variants consume semantic token roles instead of direct hard-coded color values.
    - Dark mode readiness checks for token-based components.
  - **State Messaging Contract**
    - Dynamic errors and warnings are announced and visible.
    - Save/import feedback remains understandable under keyboard and assistive tech use.
  - **Image Loading Strategy Module**
    - Non-critical list images load lazily.
    - Recipe cards remain visually stable while images load.
  - **Navigation Integrity Cleanup**
    - Primary nav links resolve to valid destinations only.

- Prior art:
  - Reuse existing Vitest-based behavior testing approach already used in the repository.
  - Follow current component testing style for Vue-based interaction tests and contract-driven assertions.

## Out of Scope

- Rebranding or changing the Culinary Atelier product identity direction.
- Introducing new meal-planning features or changing recipe/planning data models.
- Backend API redesign for recipe, planning, or shopping flows.
- External observability tooling for frontend performance telemetry.
- Large-scale IA restructuring of navigation beyond fixing broken surfaced destinations.
- Pixel-perfect redesign of every screen outside audited priority paths.

## Further Notes

- This PRD is intentionally scoped to local quality remediation based on the current audit findings.
- The work should be sequenced by risk: accessibility contracts first, then tokenization and ergonomics, then visual/performance optimization, then final polish.
- Completion criteria should include a measurable audit score improvement and no regression in core recipe and planning flows.
