# Issue: Roll out Planning Request Context across legacy week-template read/delete paths

Status: ready-for-agent

## Parent

[PRD: Planning Request Context for Planning Handlers](../PRD.md)

## What to build

Finish the first rollout by adopting the **Planning Request Context** seam in `GET /api/v1/planning/week-templates`, `GET /api/v1/planning/week-templates/:id`, and `DELETE /api/v1/planning/week-templates/:id`. These routes should consume the shared wrapper so trace correlation, handler metadata, and unexpected-error handling are consistent across the Planning slice, while the legacy unscoped repository behavior stays intact.

This slice should also add the request-path regression coverage needed to prove one legacy handler reports unexpected failures through the new seam with the **Request Context Trace ID** attached, without invalidating the existing trace-context or principal-resolution unit tests.

## Acceptance criteria

- [ ] The legacy week-template list, get-by-id, and delete handlers use the shared **Planning Request Context** seam.
- [ ] Legacy route shapes, success payloads, and error payloads remain unchanged, and the routes continue to use the documented unscoped repository surface.
- [ ] At least one legacy handler test proves unexpected failures are logged and wrapped through the new seam with trace correlation.
- [ ] Existing lower-level trace-context and principal-resolution tests remain valid after the handler adoption.
- [ ] The first rollout ends with principal-scoped Saved Weekplans handlers and legacy week-template CRUD handlers sharing one Planning-only request seam, while **anonymous merge**, anonymous idle purge, and month-plan routes remain untouched.

## Blocked by

- [Issue 01: Planning Request Context tracer bullet for Saved Weekplans create](./01-request-context-saved-weekplans-create.md)

## Type

AFK

## User stories covered

11, 15, 16, 21, 22, 24, 25, 30
