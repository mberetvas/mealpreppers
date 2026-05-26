# Sort all consolidation results at server boundaries

Type: AFK
Labels: needs-triage
Source: `Docs/prd/shopping-list-store-walk-order.md`

## What to build

Apply **Shopping list store walk order** at the **Shopping list consolidation** boundary so every returned **Consolidated shopping list** result is already in store-walk order, regardless of whether AI polish succeeds, is skipped, needs review, or falls back to the baseline.

## Acceptance criteria

- [ ] `consolidateShoppingList` returns `consolidatedLines` sorted by **Shopping list store walk order** for `polished`, `pending_review`, `ai_skipped`, and `baseline_fallback` statuses.
- [ ] `baselineLines` returned by consolidation are sorted by **Shopping list store walk order** so skipped-AI and fallback views start from sorted baseline data.
- [ ] Pending-review `polishResponse.lines` are sorted once before they are served to the client, while `changes` and line IDs still identify the same changed lines for the **Shopping list polish diff**.
- [ ] Sorting changes only line order and preserves ingredient names, quantities, units, IDs, and provenance.
- [ ] **Recipe sections view** ordering and grouping are unchanged.
- [ ] Unit tests cover polished, pending-review, AI-skipped, and fallback consolidation paths with observable line order assertions.

## Blocked by

- `Docs/issues/001-teach-store-walk-order-about-spices-and-sauces.md`
