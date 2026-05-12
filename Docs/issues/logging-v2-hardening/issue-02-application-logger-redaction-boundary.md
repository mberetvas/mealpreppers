# Issue: Application Logger enforces Log Redaction before output

## Parent

[PRD: Unified Server Logging and Runtime Log Controls](../../prd/PRD-logging-v2.md)

## What to build

Move **Log Redaction** from a caller-side convention to an **Application Logger** guarantee by enforcing the shared redaction policy before every structured log payload leaves the logger boundary. The slice should keep the existing **Structured Logger** behavior, but also ensure any server module that emits structured data through the shared logger facade gets the same masking for secrets and PII before output.

Deliver this as a complete vertical slice: one shared redaction policy, consistent case-insensitive key handling for the required secret and PII fields, regression tests proving redaction happens before output, and updated logger-module documentation that uses the canonical terminology from [CONTEXT.md](../../CONTEXT.md).

## Acceptance criteria

- [ ] The required **Log Redaction** keys are centralized in one shared policy and applied case-insensitively before log output.
- [ ] Structured payloads emitted through the **Application Logger** are redacted even when the caller does not go through the **Structured Logger** facade first.
- [ ] Existing **Structured Logger** behavior is preserved for event validation, payload shaping, and **Trace ID** attachment.
- [ ] Unit tests prove secrets and PII never appear in emitted payloads for both the shared logger facade and the structured facade.
- [ ] Inline documentation for the logger modules describes **Application Logger**, **Log Redaction**, and **Log Configuration** using the project glossary.

## Blocked by

None - can start immediately.

## Labels

- needs-triage

## Type

AFK

## User stories covered

1, 5, 6, 11, 15, 17, 18
