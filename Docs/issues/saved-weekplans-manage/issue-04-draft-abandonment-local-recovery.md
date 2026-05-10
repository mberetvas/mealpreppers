# Issue: Unsaved draft — navigation guards, beforeunload, optional local snapshot

## Parent

[PRD: Saved Weekplans — Manage Page and Planner Lifecycle](../../prd/PRD-saved-weekplans-manage.md)

## What to build

When the planner holds an **unsaved draft** with meaningful changes, **in-app navigation** (router transitions) must **confirm** before leaving. Use **`beforeunload`** (or equivalent) for tab close / full navigation away so users get a browser warning when appropriate.

Optionally **persist draft snapshot locally** (e.g. storage keyed by app conventions) so **refresh** or crash recovery does not wipe long sessions **before first server save**. Restore behavior must be predictable and must **not** overwrite an explicit user reset without confirmation where feasible.

Keep snapshot logic in **testable** pure helpers where possible.

## Acceptance criteria

- [ ] Leaving via internal navigation with dirty draft shows confirmation; confirming proceeds; cancel stays on planner.
- [ ] Browser/tab close path triggers unload warning when draft is dirty (within browser constraints).
- [ ] Optional local recovery restores draft after refresh when enabled by implementation; document limits (storage quota, privacy).
- [ ] Unit tests for dirty-detection and snapshot serialize/restore rules without requiring a full browser harness where feasible.

## Blocked by

- [Issue 03: Planner draft, explicit save, autosave](./issue-03-planner-draft-explicit-save-autosave.md)

## Type

AFK

## User stories covered

9–11
