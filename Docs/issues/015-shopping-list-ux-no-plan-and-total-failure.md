# Shopping list UX: no-plan state and total-failure banner copy

**Source:** REV-008 (Low), REV-009 (Low) — branch review 2026-05-25
**Type:** AFK

## What to build

Two focused UX improvements to `app/pages/shopping-list.vue`:

1. **Missing `?plan=`**: When `planId` is empty (no query parameter present), show a dedicated "No plan selected" state with a link to `/saved-weekplans`, instead of reusing the access-failure error panel. Users cannot currently distinguish "no plan linked" from "plan access denied" without reading copy carefully.

2. **Total recipe-resolution failure copy**: When the **Saved Weekplan** loads successfully but `sections.length === 0` after recipe resolution, show total-failure-specific banner text (e.g. "Could not load any recipes for this plan") instead of the same partial-load "this list may be incomplete" warning used when only some recipes failed.

## Acceptance criteria

- [ ] Empty `planId` (no `?plan=` param) renders a distinct "No plan selected" state with a link to `/saved-weekplans`; a non-empty `planId` that fails access renders the existing error panel — the two states are visually and semantically distinct
- [ ] `sections.length === 0` after a successful plan load shows total-failure-specific copy; `sections.length > 0` with some errors retains the existing "may be incomplete" partial-failure copy
- [ ] Unit tests cover all four states: no `?plan=`, plan access failure, total recipe-resolution failure, partial recipe-resolution failure

## Blocked by

None — can start immediately.
