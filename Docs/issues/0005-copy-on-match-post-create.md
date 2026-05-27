# 0005 — Copy-on-match on POST saved-weekplan create

## Parent

[PRD: Auto-consolidated shopping list redesign](../prd/auto-consolidated-shopping-list-redesign.md) — [ADR 0004](../../docs/adr/0004-auto-consolidated-shopping-list-redesign.md)

## What to build

Add a server-side copy-on-match side effect to `POST /api/v1/saved-weekplans`. After the new plan row is inserted and its **Shopping list source fingerprint** computed, look up whether another plan owned by the same **Planning Principal** has a valid **Saved consolidated shopping list** with the same fingerprint. If a match exists, copy that list (lines + fingerprint + `confirmedAt`) to the new plan immediately — no review gate, no extra client round-trip.

Rules (per ADR 0004):
- Trigger only on `POST` create, never on `PATCH`.
- Match: same principal, same fingerprint, source has a non-null saved list, source list is not deprecated relative to its own plan body.
- Tie-break: highest `confirmedAt` on the source record.
- After copy, set a one-time readable flag (`shoppingListCopiedFromMatch: true`) that the client can consume to show the copy notice. The flag may be returned on the create response or on the next `GET` of the plan — pick one consistent approach and document it in the implementation.

New method on `consolidatedShoppingListRepository.ts`: `copyConsolidatedListFromMatchingPlan(supabase, newPlanId, principal, fingerprint)`.

## Acceptance criteria

- [ ] Creating a plan whose meal grid matches an existing plan's confirmed list copies the list server-side; the new plan's `GET consolidated-shopping-list` returns the copied lines immediately.
- [ ] Copy uses the source with the highest `confirmedAt` when multiple plans match.
- [ ] Copy does not run when no fingerprint match exists (new plan proceeds to normal auto-consolidation flow on first visit).
- [ ] Copy does not run when the matching source's list is deprecated.
- [ ] Copy is scoped to the same principal — no cross-user inheritance.
- [ ] `PATCH` edits to an existing plan never trigger copy-on-match.
- [ ] The create response (or subsequent plan GET) exposes `shoppingListCopiedFromMatch: true` exactly once so the client can show the copy notice.
- [ ] Unit tests: match found → copy + flag set; no match → no copy; deprecated source → no copy; multiple matches → latest `confirmedAt` wins; different principal → no copy; PATCH → no copy.

## Blocked by

None — can start immediately.
