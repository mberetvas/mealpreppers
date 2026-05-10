# Issues: Saved Weekplans (local)

Parent: [PRD: Saved Weekplans — Manage Page and Planner Lifecycle](../../prd/PRD-saved-weekplans-manage.md)

Vertical slices are numbered in dependency order. Each file is ready to paste into an external tracker or to execute as an AFK/HITL unit.

| # | File | Type |
|---|------|------|
| 01 | [issue-01-ownership-schema-saved-weekplans-api.md](./issue-01-ownership-schema-saved-weekplans-api.md) | AFK |
| 02 | [issue-02-manage-page-list-actions.md](./issue-02-manage-page-list-actions.md) | AFK |
| 03 | [issue-03-planner-draft-explicit-save-autosave.md](./issue-03-planner-draft-explicit-save-autosave.md) | AFK |
| 04 | [issue-04-draft-abandonment-local-recovery.md](./issue-04-draft-abandonment-local-recovery.md) | AFK |
| 05 | [issue-05-auth-merge-anonymous-plans.md](./issue-05-auth-merge-anonymous-plans.md) | HITL |
| 06 | [issue-06-anonymous-idle-purge-job.md](./issue-06-anonymous-idle-purge-job.md) | AFK |
| 07 | [issue-07-ia-glossary-deprecation.md](./issue-07-ia-glossary-deprecation.md) | AFK |

Suggested dependency chain: `01 → (02, 03 parallel) → 04 → 07`; `05` after auth exists; `06` after `01`.
