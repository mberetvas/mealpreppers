# 0003 — Auto-consolidation trigger + session draft in composable

## Parent

[PRD: Auto-consolidated shopping list redesign](../prd/auto-consolidated-shopping-list-redesign.md) — [ADR 0004](../../docs/adr/0004-auto-consolidated-shopping-list-redesign.md)

## What to build

Extend `useConsolidatedShoppingList` with two capabilities:

**Auto-consolidation trigger policy.** After hydration settles on the consolidated tab (`view=consolidated`), automatically call `consolidate()` when: no valid **Saved consolidated shopping list** exists (none yet, or deprecated), no in-memory session draft for that plan is already held, and the composable is not already consolidating. The trigger must not fire when the user is only on recipe sections view, when preview is open, or when a valid saved list already exists.

**Session draft.** Store `reviewLines`, hints, baseline, warnings, and polish status in composable-level (or `useState`) memory keyed by plan id. When the user navigates away and returns to the same plan within the same browser session, resume the draft without a new AI call. Clear the draft on explicit Confirm, plan change, or explicit reset. The draft must not survive tab close.

The existing `consolidate()` method and all public API of the composable remain intact; this slice adds the automatic invocation and draft-resume logic only.

## Acceptance criteria

- [ ] Auto-trigger fires when `view=consolidated`, hydration settled, no valid saved list, no draft in memory, not already consolidating.
- [ ] Auto-trigger does not fire when a valid **Saved consolidated shopping list** is loaded.
- [ ] Auto-trigger does not fire when user is on recipe-sections tab, from preview modal, or on plan save.
- [ ] Auto-trigger does not fire a second time if a session draft already exists for the current plan.
- [ ] Returning to `view=consolidated` for the same plan within the session resumes the draft without a new POST to `consolidate-shopping-list`.
- [ ] Confirm clears the session draft for that plan.
- [ ] Switching to a different plan clears the session draft.
- [ ] Closing the tab discards all drafts (no server persistence, no localStorage).
- [ ] Fallback (`pending_review` from exact-merge) is held in the draft in the same way as AI success; the warning is part of the draft state.
- [ ] Unit tests cover: trigger fires once, draft resumes, draft clears on confirm, draft clears on plan switch, trigger blocked when valid list, trigger blocked when already consolidating.

## Blocked by

None — can start immediately.
