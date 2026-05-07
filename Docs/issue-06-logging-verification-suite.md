## What to build

Create the Logging V2 verification suite with both unit and integration coverage. Unit tests should verify external behavior for Log Configuration and redaction contracts; integration coverage should prove Trace ID propagation from request middleware into emitted logs.

## Acceptance criteria

- [ ] Unit tests cover valid/invalid Log Level handling and Execution Environment defaults.
- [ ] Unit tests cover LOG_JSON behavior and startup warning behavior for invalid level config.
- [ ] Unit tests verify redaction behavior for sensitive payload keys.
- [ ] Integration test verifies Trace ID precedence, request context storage, and inclusion in emitted logs.
- [ ] Tests assert external behavior/contracts, not implementation internals.

## Blocked by

- `issue-02-trace-context-middleware.md`
- `issue-03-structured-events-and-redaction.md`
- `issue-04-debug-request-diagnostics.md`
- `issue-05-one-pass-server-migration.md`
