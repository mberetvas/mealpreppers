# Shopping list exact merge module

**Label:** `needs-triage`

## Parent

[PRD — Shopping list AI consolidation](../prd/shopping-list-ai-consolidation.md)

## What to build

Server module for the deterministic first step of **Shopping list consolidation**. Takes scaled ingredients from all **Recipe sections** (day ascending, breakfast → lunch → dinner traversal order) and produces a **Shopping list polish baseline**: merged lines with stable `L{n}` ids, quantities, normalized units, and recipe provenance.

Merge rule: combine lines only when the normalized ingredient name **and** unit are identical, including shared unit aliases consistent with recipe ingestion (e.g. `gr` → `g`). Lines with different names or different units remain separate. Quantities are summed; provenance tracks which **Recipe sections** contributed.

Line ids (`L1`, `L2`, …) are assigned in deterministic merge-order (not catalog ingredient ids). The module also builds **Shopping list polish context** — the compact JSON blob consumed by the AI polish prompt (line ids, quantities, units, recipe provenance).

## Acceptance criteria

- [ ] Identical normalized name + unit lines merge; quantities sum correctly (e.g. `400 g` + `400 g` → `800 g`)
- [ ] Unit aliases from ingestion (e.g. `gr` → `g`) are applied before comparison so `400 gr` + `400 g` merge
- [ ] Lines with different units remain separate (e.g. `400 g` and `2 stuks` of the same ingredient)
- [ ] Line ids are deterministic `L{n}` based on merge order, not catalog ingredient ids
- [ ] Recipe provenance is tracked per merged line (which recipe sections contributed)
- [ ] Polish context JSON is built from baseline with stable ids, quantities, units, provenance
- [ ] Float quantities rounded to 2 decimals (consistent with existing `utils/shoppingList` behavior)
- [ ] Unit tests cover: merge, aliases, separate units, provenance, line id stability, empty input, single-recipe plan

## Blocked by

None — can start immediately.
