# Issue: Planning request logs always use the Request Context Trace ID

## Parent

[PRD: Unified Server Logging and Runtime Log Controls](../../prd/PRD-logging-v2.md)

## What to build

Harden the Planning slice so request-scoped log entries always use the resolved **Request Context Trace ID** instead of omitted values or raw header reads. This slice covers the month-plan handlers that currently delegate unexpected errors without passing the **Trace ID**, plus the anonymous idle purge route that bypasses **Trace Header Precedence** by reading `x-trace-id` directly.

The finished slice is end-to-end: Planning request handlers use the resolved **Trace ID**, middleware precedence remains the single source of truth, unexpected Planning errors stay correlated in logs, and tests prove the request-scoped entries keep correlation without leaking bodies or secrets.

## Acceptance criteria

- [ ] Request-scoped Planning handlers pass the resolved **Request Context Trace ID** into unexpected-error logging instead of omitting it.
- [ ] The anonymous idle purge route uses the resolved request-context value, not a raw `x-trace-id` header read.
- [ ] **Trace Header Precedence** remains owned by the trace middleware, with no duplicate precedence logic elsewhere in Planning request paths.
- [ ] Regression tests cover at least one month-plan unexpected-error path and the internal purge route path for **Trace ID** propagation.
- [ ] Planning-facing logger documentation uses the terms **Planning Request Context**, **Trace ID**, and **Request Context Trace ID** consistently.

## Blocked by

None - can start immediately.

## Labels

- needs-triage

## Type

AFK

## User stories covered

3, 4, 13, 15, 17, 18
