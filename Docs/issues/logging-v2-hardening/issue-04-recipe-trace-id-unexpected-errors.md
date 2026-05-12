# Issue: Recipe unexpected-error logs keep Trace ID correlation

## Parent

[PRD: Unified Server Logging and Runtime Log Controls](../../prd/PRD-logging-v2.md)

## What to build

Extend the recipe unexpected-error path so the shared recipe error helper accepts and emits the resolved **Trace ID** for request-scoped failures. The completed slice updates the recipe HTTP handlers to pass the request-context value, keeps the existing recipe error contract intact for callers, and proves in tests that unexpected recipe failures remain correlated across logs and HTTP responses.

This slice is intentionally narrow but complete: request handler adoption, helper contract update, regression tests for trace-aware error logging, and inline documentation aligned with the **Application Logger** and **Trace ID** vocabulary.

## Acceptance criteria

- [ ] The shared recipe unexpected-error helper accepts the resolved **Trace ID** for request-scoped calls.
- [ ] All recipe HTTP handlers that use the helper pass the **Request Context Trace ID**.
- [ ] Unexpected recipe failures emit structured log entries that include the request-scoped **Trace ID**.
- [ ] Unit or seam tests cover at least one recipe unexpected-error path and prove the emitted entry carries the expected **Trace ID**.
- [ ] Updated doc comments describe the trace-aware recipe error flow using the canonical logging terminology.

## Blocked by

None - can start immediately.

## Labels

- needs-triage

## Type

AFK

## User stories covered

3, 13, 15, 17, 19
