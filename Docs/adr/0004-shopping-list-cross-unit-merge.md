# ADR 0004 — Shopping list cross-unit merge and v2 polish policy

**Status:** Accepted  
**Date:** 2026-05-26  
**Related:** [ADR 0002 — Shopping list AI consolidation](./0002-shopping-list-ai-consolidation.md), [ADR 0003 — Shopping list human review and persistence](./0003-shopping-list-human-review-and-persistence.md)  
**Domain vocabulary:** `CONTEXT.md` (Shopping list section)

---

## Context

**Shopping list exact merge** only combines lines with the same normalized name and identical unit. A week plan with `tomaten` 400 g and `tomaten` 0.5 kg therefore produced two baseline rows, pushing unit conversion and duplicate cleanup to **Shopping list AI polish**.

The v1 AI prompt instructed Dutch supermarket renames and forbade unit changes. The harness accepted renames and rejected conversions (e.g. 500 g → 0.5 kg failed `unit-policy`). That contradicted the product goal: preserve recipe ingredient names, aggregate same-product lines deterministically, and use AI only as an optional, name-safe pass.

## Decision

### 1. Deterministic **Shopping list cross-unit merge**

After exact merge, a pure function groups lines by **exact** `name` string (post–exact-merge display name), partitions by unit dimension (`mass`, `volume`, `count`, or unknown), and merges quantified lines within a partition when units convert.

- Allowed conversions: g↔kg, ml↔dl↔l.
- No mass↔volume, mass↔count, or `el`↔`ml` in v1 of this table.
- Survivor line: lexicographically smallest baseline id (e.g. `L1`); quantity summed in the survivor’s unit.
- Provenance unioned across merged lines.

### 2. **Shopping list polish baseline** semantics

`baselineLines` and **Shopping list polish context** use the output of cross-unit merge, not raw exact merge. Clients comparing baseline length to exact-merge-only output will see fewer lines when cross-unit merges occurred.

### 3. **Shopping list AI polish** (v2 prompt)

- Role: quantity consolidator, not label optimizer.
- Hard rule: copy `name` verbatim.
- May merge identical names with allowed unit families; document absorbed ids in `changes.absorbedIds`.
- Temperature remains 0; deterministic pre-merge reduces model drift.

### 4. Harness v2

| Rule | Behavior |
|------|----------|
| `name-unchanged` | Response `name` must match baseline line for that id (trim-only) |
| `unit-conversion` | Unit must match baseline or be convertible within the same dimension |
| `quantity-cap` | Cap = sum of baseline quantities for exact name + dimension, converted to response unit |
| `no-removed-lines` | Missing baseline id allowed when `changes` lists it in `absorbedIds` |
| `no-invented-ingredients` | Unchanged |

Renames and cross-dimension units are errors (hints in review flow).

## Consequences

- Consolidation delivers fewer, correct rows even when AI is skipped or fails.
- Baseline API shape unchanged; baseline **content** may have fewer lines than before.
- v1 Dutch-rename and no-conversion AI/harness behavior is retired; update tests and docs accordingly.
- Fuzzy name merge (`ui` vs `uien`) remains out of scope.

## Verification

- `test/unit/shopping-list-cross-unit-merge.test.ts`
- `test/unit/shopping-list-polish-harness.test.ts`
- `test/unit/shopping-list-polish-integration.test.ts` (cross-unit baseline when AI skipped)
