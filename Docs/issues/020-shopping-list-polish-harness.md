# Shopping list polish harness

**Label:** `needs-triage`

## Parent

[PRD — Shopping list AI consolidation](../prd/shopping-list-ai-consolidation.md)

## What to build

Server module that validates a **Shopping list polish response** against the **Shopping list polish baseline**. This is the safety contract between AI output and the consolidation pipeline — it ensures the model cannot invent ingredients, inflate quantities, or violate unit/locale policy.

Validation rules:
- **No invented ingredients:** every line id in the polish response must exist in the baseline.
- **Quantity caps:** total quantity per (name, unit) pair in the polished output must not exceed the corresponding baseline sum.
- **Shopping list unit policy (v1):** no unit conversion — polished lines may only use units already present in the baseline for that ingredient.
- **Shopping list polish locale (v1):** canonical names must be Dutch store-style labels.

On any validation failure, the harness returns a structured failure (not a thrown exception) so the consolidation service can apply **Shopping list polish fallback** without a repair loop.

## Acceptance criteria

- [ ] Rejects polish response containing line ids not present in baseline
- [ ] Rejects (or clamps) quantity inflation vs baseline sums per name/unit
- [ ] Rejects polish output that introduces units not present in baseline for that ingredient
- [ ] Returns structured pass/fail result (not exception) for orchestration flow control
- [ ] Unit tests cover: valid polish passes, invented line id rejected, quantity inflation rejected, unit policy violation rejected, empty polish response, baseline with single line

## Blocked by

None — can start immediately.
