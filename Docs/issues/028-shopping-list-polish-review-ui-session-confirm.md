# 028 — Shopping list polish review UI (session confirm)

## Parent

[PRD: Shopping list human review and persistence](../prd/shopping-list-human-review-and-persistence.md)

## What to build

After **Consolidate action**, the shopping page enters **Shopping list polish review**: **Shopping list polish reference** tabs (recipe sections | polish baseline) and an editable AI column (canonicalized model lines). Inline **Shopping list polish hint**s per row. **Shopping list polish confirm** applies edits to the in-session **Consolidated shopping list** (no database persistence yet). Desktop: side-by-side; mobile: stacked, reference on top. Error-level hints require explicit acknowledgment before confirm; info hints do not block. Remove or replace harness-rejection fallback banners for cases now handled by review.

## Acceptance criteria

- [ ] Consolidated view transitions to review when `polishStatus === 'pending_review'`
- [ ] Reference tabs show recipe sections and **Shopping list polish baseline** without re-fetching unrelated data
- [ ] User can edit `name`, `quantity`, `unit` on existing line IDs only; confirm updates displayed consolidated list
- [ ] Error hints show acknowledgment control before confirm when any remain
- [ ] Responsive layout: side-by-side at desktop breakpoint, stacked on narrow viewports
- [ ] Component tests cover review entry, hint acknowledgment, and confirm → consolidated display
- [ ] Composable/state tests cover `pending_review` → confirmed session list
- [ ] Baseline-only fallback (timeout / no key) still shows existing warning UX without review

## Blocked by

- [027 — Consolidate returns pending_review with polish hints](./027-consolidate-pending-review-and-polish-hints.md)

## User stories covered

3–10, 11–14, 31 (review only; persistence in 029)
