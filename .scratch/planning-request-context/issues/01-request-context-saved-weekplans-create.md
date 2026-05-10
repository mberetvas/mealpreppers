# Issue: Planning Request Context tracer bullet for Saved Weekplans create

Status: ready-for-agent

## Parent

[PRD: Planning Request Context for Planning Handlers](../PRD.md)

## What to build

Introduce the first end-to-end **Planning Request Context** slice by building the Planning-only handler wrapper and using it for `POST /api/v1/saved-weekplans`. The wrapper should resolve the **Planning Principal** through a **Planning auth adapter**, read the **Request Context Trace ID** that existing middleware already places on the request, bind a request-scoped **Application Logger** with stable handler metadata, and centralize unexpected-error logging and wrapping. The adopting handler should keep ownership of request parsing, schema validation, recipe existence checks, and repository orchestration, but stop rebuilding principal, trace, logger, and error plumbing inline.

Keep the public Saved Weekplans contract unchanged. Expected HTTP errors still pass through unchanged. Unexpected failures should log once with trace correlation and an error identifier, then return the standard Planning 500 payload. Add the interface-level tests needed to make this first slice safe for later handler adoption.

## Acceptance criteria

- [ ] A **Planning Request Context** interface exists for Planning handlers and includes the **Request Context Trace ID**, current **Planning Principal**, current principal kind, and a request-scoped **Application Logger** bound to stable handler metadata.
- [ ] A **Planning auth adapter** resolves authenticated bearer input behind an injectable seam and falls back to anonymous Planning session behavior without changing existing cookie rules.
- [ ] `POST /api/v1/saved-weekplans` uses the new wrapper without changing request or response shapes, validation behavior, recipe-id validation, or repository semantics.
- [ ] Expected HTTP errors from validation or planning failures pass through unchanged, while unexpected failures log once with trace correlation and return the standard Planning 500 payload with an error identifier.
- [ ] Automated tests cover the **Planning Request Context** interface and at least one handler-level unexpected failure path for Saved Weekplans create.

## Blocked by

None - can start immediately.

## Type

AFK

## User stories covered

1, 3, 4, 5, 6, 7, 8, 9, 15, 18, 19, 20, 22, 24
