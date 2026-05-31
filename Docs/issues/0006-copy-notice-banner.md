# 0006 — Consolidated shopping list copy notice banner

## Parent

[PRD: Auto-consolidated shopping list redesign](../prd/auto-consolidated-shopping-list-redesign.md) — [ADR 0004](../../docs/adr/0004-auto-consolidated-shopping-list-redesign.md)

## What to build

Show a one-time dismissible **Consolidated shopping list copy notice** the first time a user opens the preview modal or the full shopping-list page for a newly created plan whose list was copied via copy-on-match (issue 0005).

The notice communicates that the list was inherited from a matching week's confirmed list and invites the user to review if needed. Dismiss state is stored client-side (e.g. `localStorage`) keyed by plan id so "one-time" survives in-session navigation but is not conflated with server persistence. The server flag (`shoppingListCopiedFromMatch`) consumed from the plan response drives whether to show the notice on first render; once dismissed it never reappears even if the user navigates away and back.

Component location: `app/components/shopping-list/ConsolidatedListCopyNotice.vue`.

## Acceptance criteria

- [ ] Banner is shown on the first open of preview modal or full shopping-list page when `shoppingListCopiedFromMatch` is truthy.
- [ ] Banner is not shown on subsequent opens after the user dismisses it (dismiss persisted in localStorage keyed by plan id).
- [ ] Banner is not shown when copy-on-match was not used for the plan.
- [ ] Banner is not shown when the user has already opened and dismissed for that plan in a prior session.
- [ ] Dismissal does not require a server call.
- [ ] Component tests cover: shown on first open, hidden after dismiss, hidden when flag absent.

## Blocked by

- [0005 — Copy-on-match on POST saved-weekplan create](./0005-copy-on-match-post-create.md)
