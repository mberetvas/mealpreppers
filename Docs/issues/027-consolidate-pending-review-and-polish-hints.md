# 027 — Consolidate returns pending_review with polish hints

## Parent

[PRD: Shopping list human review and persistence](../prd/shopping-list-human-review-and-persistence.md)

## What to build

End-to-end server path: when **Shopping list AI polish** succeeds at the provider, **POST consolidate** returns `polishStatus: 'pending_review'` with `polishResponse`, `baselineLines`, and `hints[]`—even when former harness rules would have failed. Extract a **polish hint builder** from harness rules (canonicalize polish, map rules to per-line hints with severity). Harness no longer triggers **Shopping list polish fallback** for validation-only failures. Timeout, parse, and missing API key still return baseline fallback as today.

## Acceptance criteria

- [ ] **Week plan shopping source fingerprint** module exists with stable canonical `body` digest (sorted keys, days 1–7); unit tests for stability and change detection
- [ ] **Polish hint builder** returns `info` / `error` hints for known harness violations; unit tests cover unit-policy and quantity-cap cases
- [ ] **Shopping list consolidation service** returns `pending_review` + full polish payload when model succeeds and hints exist; does not discard AI lines on harness violations
- [ ] **POST** `/api/v1/saved-weekplans/:id/consolidate-shopping-list` response documented in API tests; existing clients’ `consolidatedLines` behavior documented or gated for `pending_review`
- [ ] Structured logs include hint counts / `failuresByRule` without full ingredient payloads
- [ ] `bun run test:unit` passes for touched consolidation and harness tests

## Blocked by

- [026 — ADR: Shopping list human review and persistence](./026-shopping-list-adr-human-review-persistence.md) (recommended, not strictly required for code)

## User stories covered

1, 2, 11, 13, 14, 15, 35, 36, 37, 40
