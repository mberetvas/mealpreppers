# Issue: Planner — draft, explicit first save, URL identity, autosave after persist

## Parent

[PRD: Saved Weekplans — Manage Page and Planner Lifecycle](../../prd/PRD-saved-weekplans-manage.md)

## What to build

Evolve the **weekly planner** so **draft** means **no server row**: user edits freely until **explicit Save**. Require a **non-empty trimmed inline title** in the planner chrome before Save can succeed. **POST** creates the Saved Weekplan; after success, the client enters **saved mode** with a **stable identifier** in the route (query or path—match manage page **Open** links).

Once an identifier exists, apply **debounced autosave** for grid and title changes (**PATCH**), with visible **save status** (saved / saving / dirty / error) consistent with today’s planner UX. **No PATCH autosave** before the first successful create.

Keep **one** planner implementation for draft and saved modes (deep links refresh correctly).

## Acceptance criteria

- [ ] Opening planner **without** saved id does **not** create a database row.
- [ ] **Save** is disabled or blocked until title is valid; successful Save performs **POST** and transitions to saved mode with id in the URL.
- [ ] After save, edits trigger **debounced PATCH** only when id is present; status indicators reflect lifecycle.
- [ ] Loading planner **with** saved id **GET**s that plan and hydrates editor state.
- [ ] Automated tests extend existing planning autosave / week-plan tests for **draft vs post-create** behavior.

## Blocked by

- [Issue 01: Ownership schema and Saved Weekplans API](./issue-01-ownership-schema-saved-weekplans-api.md)

## Type

AFK

## User stories covered

1–8, 24–25
