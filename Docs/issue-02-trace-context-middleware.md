## What to build

Add request-level Trace ID propagation by implementing middleware that resolves inbound trace identity using the agreed Trace Header Precedence (`x-trace-id` then `x-request-id` then generated UUID), stores the resolved value in Request Context Trace ID, and makes it available to request-scoped logging.

## Acceptance criteria

- [ ] Request middleware resolves Trace ID using `x-trace-id` first, `x-request-id` second, UUID fallback third.
- [ ] The resolved Trace ID is stored on request context for downstream use.
- [ ] Request-scoped logging can access and include the Request Context Trace ID without per-function argument plumbing.
- [ ] Behavior is deterministic when headers are missing or malformed.

## Blocked by

- `issue-01-logging-v2-foundation.md`
