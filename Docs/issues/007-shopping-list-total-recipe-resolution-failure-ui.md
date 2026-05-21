# 007 — Shopping list total recipe resolution failure UI

**Type:** AFK  
**Labels:** needs-triage  
**User stories:** 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 17, 18, 19

## Parent

[PRD: Shopping list — pre-release fixes (gate B)](../prd/shopping-list-pre-release-fixes.md)

## What to build

End-to-end UI for **shopping list total recipe resolution failure**: the **Saved Weekplan** loaded, every referenced **Recipe Catalog** fetch failed, and there are no **recipe sections** to show.

Users see the existing partial-load warning banner plus a dedicated parchment empty block (not plan-access error, not **shopping list empty plan**). Copy and actions are locked in the PRD:

- Heading: “Could not load recipes for this plan”
- Body: catalog failure, suggest Refresh (header only) and planner
- Single CTA in the block: **Open in Planner** with the current plan id

Partial failure (some recipes loaded) and empty grid (no slots, `failedRecipeCount === 0`) must remain unchanged.

## Acceptance criteria

- [ ] When `planLoaded`, `sections.length === 0`, and `failedRecipeCount > 0`, the warning banner and total-failure empty block are both visible.
- [ ] Total-failure block shows the agreed heading and body copy.
- [ ] Total-failure block includes **Open in Planner** linking to the weekly planner with the current **Shopping list plan link** id; no duplicate Refresh in the block.
- [ ] Plan name remains visible in the header in this state.
- [ ] `failedRecipeCount === 0` with no sections still shows only “This plan has no recipes yet” (no total-failure block).
- [ ] Partial failure (`sections.length > 0` and `failedRecipeCount > 0`) still shows sections plus warning only (no total-failure block).
- [ ] Plan access error state is unchanged and does not show total-failure copy.
- [ ] Template or presentation test asserts total-failure copy and planner link; asserts empty-plan copy is absent in total-failure conditions.

## Blocked by

- [006 — Shopping list reload on plan link change](./006-shopping-list-reload-on-plan-link-change.md) (same page module; reduces merge conflict)
