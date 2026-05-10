# Issue: Roll out Planning Request Context across legacy week-template write paths

Status: ready-for-agent

## Parent

[PRD: Planning Request Context for Planning Handlers](../PRD.md)

## What to build

Adopt the **Planning Request Context** seam in the legacy `POST /api/v1/planning/week-templates` and `PATCH /api/v1/planning/week-templates/:id` handlers while keeping the legacy surface behavior unchanged. The goal is to remove duplicated request-scoped plumbing from these routes so they resolve trace and logging through the same Planning wrapper, but still leave legacy repository access unscoped exactly as documented in `DEPRECATED.md`.

Keep request and response bodies, validation messages, and storage behavior unchanged. Do not add Saved Weekplans ownership rules or new auth gating to the legacy routes.

## Acceptance criteria

- [ ] The legacy week-template POST and PATCH handlers use the shared **Planning Request Context** seam for trace-aware logging and unexpected-error wrapping.
- [ ] Both routes keep the existing unscoped repository behavior and continue to avoid Saved Weekplans-specific ownership filtering.
- [ ] Validation behavior, success payloads, and error payloads remain unchanged for current callers.
- [ ] Stable handler metadata makes logs searchable alongside Saved Weekplans routes without exposing raw identifiers.
- [ ] Automated tests cover representative success and failure paths for both legacy write routes.

## Blocked by

- [Issue 01: Planning Request Context tracer bullet for Saved Weekplans create](./01-request-context-saved-weekplans-create.md)

## Type

AFK

## User stories covered

4, 5, 6, 11, 16, 21, 24, 25, 30
