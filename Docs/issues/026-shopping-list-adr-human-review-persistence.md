# 026 — ADR: Shopping list human review and persistence

## Parent

[PRD: Shopping list human review and persistence](../prd/shopping-list-human-review-and-persistence.md)

## What to build

Author **ADR 0003** documenting the reversal of ephemeral **Consolidated shopping list** behavior and the move from server harness gatekeeper to **Shopping list polish review** + **Shopping list polish confirm**. Link from `CONTEXT.md` Planning or Shopping list section. Align vocabulary with resolved grill session terms (fingerprint, deprecation, `pending_review`, hints-only harness).

## Acceptance criteria

- [ ] `docs/adr/0003-shopping-list-human-review-and-persistence.md` exists with context, decision, consequences, and alternatives considered
- [ ] ADR references PRD and notes supersession of ephemeral persistence from ADR 0002 / original consolidation PRD
- [ ] `CONTEXT.md` links to ADR 0003 (no contradiction with **Consolidated shopping list persistence**)
- [ ] Unit test or doc contract test asserts ADR exists and uses project vocabulary (mirror `saved-weekplans-single-persistence-adr` pattern if applicable)

## Blocked by

None — can start immediately
