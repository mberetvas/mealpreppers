# 030 — Deprecated saved consolidated shopping list UX

## Parent

[PRD: Shopping list human review and persistence](../prd/shopping-list-human-review-and-persistence.md)

## What to build

When **Shopping list source fingerprint** on the stored record does not match the current **Saved Weekplan** `body`, treat the list as **Deprecated saved consolidated shopping list**: prominent warning, read-only display of old lines for comparison, **Consolidate action** to build a replacement. Confirm / **PUT** must not update the active saved list while deprecated (or PUT rejects with clear error). `shoppingListDeprecated: true` on plan **GET** drives the banner.

## Acceptance criteria

- [ ] Editing plan `body` and reloading sets `shoppingListDeprecated` and shows deprecation warning
- [ ] Deprecated list lines are read-only (no confirm to overwrite without re-consolidate)
- [ ] **Consolidate action** after deprecation opens **Shopping list polish review**; confirm **PUT** saves new record with fresh fingerprint
- [ ] Component test: deprecated banner + read-only list + consolidate path
- [ ] API test: **PUT** behavior when deprecated (reject or require re-consolidate per implementation decision in ADR)

## Blocked by

- [029 — Saved consolidated shopping list persistence](./029-saved-consolidated-shopping-list-persistence.md)

## User stories covered

21–24
