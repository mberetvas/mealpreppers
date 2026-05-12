# Issue: Request Diagnostics Logging follows resolved Log Configuration

## Parent

[PRD: Unified Server Logging and Runtime Log Controls](../../prd/PRD-logging-v2.md)

## What to build

Make **Request Diagnostics Logging** use the resolved **Log Configuration** from the **Application Logger** instead of reading `LOG_LEVEL` directly at the middleware call site. The completed slice should preserve existing request metadata output, continue to exclude request and response bodies, and ensure diagnostics emit whenever the resolved **Log Level** is `debug`, including the safe fallback cases for missing or invalid `LOG_LEVEL` values.

Cover the end-to-end behavior from runtime configuration through middleware emission and automated tests: unresolved or invalid env input falls back safely, request-scoped diagnostics keep the **Trace ID**, and `info` or higher still suppress diagnostics.

## Acceptance criteria

- [ ] **Request Diagnostics Logging** is gated by the resolved **Log Level** from the shared **Log Configuration**, not by raw environment-variable checks in middleware.
- [ ] When `LOG_LEVEL` is absent or invalid outside `production`, diagnostics still emit because the effective **Log Level** falls back to `debug`.
- [ ] When the effective **Log Level** is `info`, `warn`, or `error`, diagnostics do not emit.
- [ ] Logged request diagnostics remain metadata-only and do not include request or response bodies.
- [ ] Unit and integration tests cover valid, invalid, and absent `LOG_LEVEL` cases plus **Trace ID** propagation into `http.request_handled`.

## Blocked by

None - can start immediately.

## Labels

- needs-triage

## Type

AFK

## User stories covered

3, 4, 7, 8, 9, 10, 12, 14, 15, 16, 20
