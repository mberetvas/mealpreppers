# 0007 — Aisle section UI component

## Parent

[PRD: Auto-consolidated shopping list redesign](../prd/auto-consolidated-shopping-list-redesign.md) — [ADR 0004](../../docs/adr/0004-auto-consolidated-shopping-list-redesign.md)

## What to build

Build a `ShoppingListAisleSection` presentational component that renders consolidated lines grouped under labeled, collapsible aisle sections following Dutch supermarket walk order. The component is shared by the preview modal, the polish review panel, and the saved consolidated view on the full shopping-list page.

The server already returns flat lines sorted by **Shopping list store walk order** via `sortShoppingListLines` in `server/services/shopping-list/aisleSort.ts`, and `inferAisleCategory` maps a line to a Dutch aisle label. The client component calls a `groupLinesByAisle` helper (thin wrapper over `inferAisleCategory`) to partition lines into labeled groups, renders each group as a collapsible section, starts all sections expanded on mount, and never persists collapse state.

A `readonly` prop disables any interaction affordances (used in preview and the deprecated read-only comparison panel).

Component location: `app/components/shopping-list/AisleSection.vue`; grouping helper in `utils/shoppingList.ts` or a new `utils/aisleGrouping.ts`.

Wire the component into the existing saved consolidated view and the polish review panel on `app/pages/shopping-list.vue` / `app/components/shopping-list/PolishReview.vue` so the aisle layout is live everywhere, not just in new UI.

## Acceptance criteria

- [ ] Lines are grouped by Dutch aisle label derived from `inferAisleCategory`.
- [ ] Groups are rendered in `AISLE_CATEGORY_ORDER` walk order; groups with no lines are omitted.
- [ ] Each aisle section is collapsible; all sections start expanded on mount.
- [ ] Collapse state is ephemeral — navigating away and back resets all sections to expanded.
- [ ] `readonly` prop hides any edit/check-off affordances.
- [ ] Component is used by the saved consolidated display on the full shopping-list page.
- [ ] Component is used by the polish review panel (`PolishReview.vue`), with grouping optional or toggled by prop.
- [ ] Component tests: correct grouping, correct walk order, empty groups omitted, all expanded on mount, collapse is local only.

## Blocked by

None — can start immediately.
