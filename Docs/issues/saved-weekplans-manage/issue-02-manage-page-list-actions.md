# Issue: Manage page — list, sort, empty state, rename, delete, open

## Parent

[PRD: Saved Weekplans — Manage Page and Planner Lifecycle](../../prd/PRD-saved-weekplans-manage.md)

## What to build

Add a **dedicated page** where users see **their** Saved Weekplans: **default sort** most recently updated first, **ephemeral toggle** between **Updated** and **Name** (no persisted preference). Each row supports **Open** (navigate to the weekly planner with that plan’s identifier), **inline rename** (click-to-edit, commit on blur or explicit confirm per UX consistency), and **Delete** behind a **simple confirmation** dialog—not type-to-confirm.

When the user has **no** Saved Weekplans, show copy that explains **draft vs saved** and a primary **Create a week plan** control that starts a **draft** planner session (no server row yet). Wire navigation so this page is reachable from primary IA (exact placement follows existing nav patterns).

Use **Saved Weekplan** in user-facing strings; align with API responses from the new routes.

## Acceptance criteria

- [ ] Manage page lists Saved Weekplans for the current principal via the Saved Weekplans API.
- [ ] Default ordering matches **recently updated**; toggle switches between **Updated** and **Name** without storing preference.
- [ ] **Open** loads the planner for that id (shape of URL/query agreed with planner issue—relative link only).
- [ ] **Inline rename** PATCHes title and reflects updates in the list.
- [ ] **Delete** asks for confirmation then removes the row and updates the list.
- [ ] **Empty state** explains draft vs saved and offers **Create a week plan** to draft planner.
- [ ] Automated tests cover sorting behavior on stub data or component contract where the project already does so for lists.

## Blocked by

- [Issue 01: Ownership schema and Saved Weekplans API](./issue-01-ownership-schema-saved-weekplans-api.md)

## Type

AFK

## User stories covered

12–19, 27 (copy)
