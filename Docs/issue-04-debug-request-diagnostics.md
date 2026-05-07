## What to build

Add Request Diagnostics Logging to capture request/response metadata for troubleshooting, but only when Log Level is `debug`. Diagnostics must remain metadata-only by default and must not include request/response bodies.

## Acceptance criteria

- [ ] Request diagnostics are emitted only at `debug` Log Level.
- [ ] Diagnostics include metadata needed for troubleshooting (for example method, path, status, duration).
- [ ] Request/response bodies are not logged by default.
- [ ] Diagnostics respect the shared structured logging contract and include trace context.

## Blocked by

- `issue-01-logging-v2-foundation.md`
- `issue-02-trace-context-middleware.md`
- `issue-03-structured-events-and-redaction.md`
