# Issue: Roll out Planning Request Context across Saved Weekplans read/update/delete

Status: ready-for-agent

## Parent

[PRD: Planning Request Context for Planning Handlers](../PRD.md)

## What to build

Expand the adopted **Planning Request Context** seam across the remaining principal-scoped **Saved Weekplans** CRUD handlers: list, get by id, patch, and delete. Each handler should receive the current **Planning Principal**, **Request Context Trace ID**, principal kind, and pre-bound request-scoped **Application Logger** from the wrapper rather than recomputing them inline. Keep handler bodies focused on parsing, validation, recipe checks, and repository orchestration.

Preserve the current Saved Weekplans HTTP surface, ownership behavior, and mutation log events. Do not pull **anonymous merge** into this slice.

## Acceptance criteria

- [ ] `GET /api/v1/saved-weekplans`, `GET /api/v1/saved-weekplans/:id`, `PATCH /api/v1/saved-weekplans/:id`, and `DELETE /api/v1/saved-weekplans/:id` all adopt the wrapper and preserve existing route shapes and response bodies.
- [ ] Principal resolution, principal-kind logging, trace correlation, and unexpected-error wrapping come from the shared **Planning Request Context** seam rather than handler-local composition.
- [ ] Saved Weekplan mutation logs continue to emit stable event names and log-safe principal kind values without exposing raw user or session identifiers.
- [ ] Existing ownership rules for authenticated and anonymous Saved Weekplans remain unchanged.
- [ ] Automated tests cover at least one read route and one mutating route through the adopted seam.

## Blocked by

- [Issue 01: Planning Request Context tracer bullet for Saved Weekplans create](./01-request-context-saved-weekplans-create.md)

## Type

AFK

## User stories covered

2, 7, 8, 10, 15, 16, 17, 24, 27, 28, 29, 30
