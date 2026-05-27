# 0004 — Shopping-list page: auto-switch to consolidated view + deprecated auto-trigger

## Parent

[PRD: Auto-consolidated shopping list redesign](../prd/auto-consolidated-shopping-list-redesign.md) — [ADR 0004](../../docs/adr/0004-auto-consolidated-shopping-list-redesign.md)

## What to build

Update `app/pages/shopping-list.vue` (the page adapter) to orchestrate the new automatic flows driven by the composable from issue 0003:

**Auto-switch to consolidated tab.** When the URL has no `?view=` query: if no valid saved list or list is deprecated → set `view=consolidated` in the URL and let the composable trigger consolidation; if a valid saved list exists → default to `view=consolidated` (per ADR). When the user explicitly switches to recipe sections via the toggle, respect that choice.

**Deprecated auto-trigger.** When `shoppingListDeprecated` is true and the page opens on consolidated view: show an explicit "Recipes changed — building a new list…" notice, keep the deprecated lines visible read-only in a collapsed **Previous list** section for comparison, then immediately invoke the auto-trigger into **Shopping list polish review** (no blocking error screen, no manual button required).

**Review auto-open.** After a successful consolidation (AI success or exact-merge fallback), the review UI opens automatically — the user should not need to press a separate button to enter review.

**Fallback warning.** When exact-merge fallback is used, display a clear warning inside the review that AI polish was not applied (story 9). This is surfaced from the composable draft state.

Today the page shows a manual "Consolidate" button as the only path and leaves the deprecated state on a read-only view. This slice removes that as the primary path; the manual **Consolidate action** remains as a secondary retry/re-run control.

## Acceptance criteria

- [ ] Opening `/shopping-list?plan=X` with no `?view=` and no valid saved list auto-switches URL to `?view=consolidated` and starts consolidation without user interaction.
- [ ] Opening with no `?view=` and a valid saved list defaults to `?view=consolidated`.
- [ ] User-selected recipe-sections toggle is not overridden when a valid saved list exists.
- [ ] Opening consolidated view with a deprecated list shows "Recipes changed" notice before review starts.
- [ ] Deprecated lines are displayed read-only (collapsed "Previous list") alongside the new review.
- [ ] Auto-trigger runs immediately after the deprecated notice — no manual button required for the primary flow.
- [ ] After successful consolidation, review UI opens automatically.
- [ ] Fallback warning ("AI polish was not applied") is visible in review when exact-merge was used.
- [ ] Manual **Consolidate action** button remains available for retry / explicit re-run.
- [ ] Empty plan (no recipe slots) shows an explanatory message rather than looping.
- [ ] Component tests cover: fresh plan auto-consolidates, deprecated auto-retriggers, valid list defaults to consolidated tab, recipe-sections toggle respected.

## Blocked by

- [0003 — Auto-consolidation trigger + session draft in composable](./0003-auto-consolidation-trigger-session-draft.md)
