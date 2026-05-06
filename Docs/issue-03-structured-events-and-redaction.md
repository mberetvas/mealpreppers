## What to build

Implement a structured logging contract on top of the shared Application Logger that enforces canonical Log Event Name format (`domain.action` in snake_case), emits stable structured payloads, and applies centralized Log Redaction before output so secrets/PII are not leaked.

## Acceptance criteria

- [ ] Structured log entries include canonical event naming (`domain.action`, snake_case).
- [ ] Structured payloads include stable fields needed for correlation and querying.
- [ ] Centralized Log Redaction is applied before emission, independent of caller behavior.
- [ ] Sensitive keys (including token/credential/PII-like fields) are masked or removed consistently.

## Blocked by

- `issue-01-logging-v2-foundation.md`
