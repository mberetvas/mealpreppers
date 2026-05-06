## What to build

Execute a one-pass migration of server code to Logging V2 so all server modules use the shared Application Logger contract. Enforce the hard rule that direct `consola` imports are removed outside the shared logger module.

## Acceptance criteria

- [ ] Server-side logging uses the shared logger contract consistently.
- [ ] Direct `consola` imports are removed from non-logger server modules.
- [ ] Existing domain event/error logging paths continue to function with trace-aware structured entries.
- [ ] Migration is complete in one pass without introducing a legacy kill-switch path.

## Blocked by

- `issue-01-logging-v2-foundation.md`
- `issue-02-trace-context-middleware.md`
- `issue-03-structured-events-and-redaction.md`
- `issue-04-debug-request-diagnostics.md`
