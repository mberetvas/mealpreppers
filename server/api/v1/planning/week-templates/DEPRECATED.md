# Deprecated: `/api/v1/planning/week-templates`

These routes remain **available and unchanged** while callers migrate. **Do not** extend them with new behavior.

## Preferred API (Saved Weekplans)

Use the principal-scoped Saved Weekplans surface instead:

- `GET /api/v1/saved-weekplans` — list for the current session or user
- `POST /api/v1/saved-weekplans` — create
- `GET|PATCH|DELETE /api/v1/saved-weekplans/:id` — read, update, delete
- `GET /api/v1/saved-weekplans/anonymous-merge-preview` and `POST /api/v1/saved-weekplans/anonymous-merge` — account handoff

## Legacy behavior

`week-templates` continues to use the **unscoped** planning repository (service role, no per-user filter), including rows with no owner columns. Removal is tracked separately once no callers depend on it.
