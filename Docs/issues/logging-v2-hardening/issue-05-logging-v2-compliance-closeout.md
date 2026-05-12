# Issue: Logging v2 compliance audit and terminology closeout

## Parent

[PRD: Unified Server Logging and Runtime Log Controls](../../prd/PRD-logging-v2.md)

## What to build

Close the **Logging v2** hardening effort with a verifiable compliance pass against the PRD and the glossary in [CONTEXT.md](../../CONTEXT.md). This slice reruns the agreed searches and tests, confirms the hard rule against direct `consola` imports outside the shared logger module, verifies **Trace ID** propagation and `x-trace-id` echoing, and aligns the final documentation in [README.md](../../README.md), [CONTEXT.md](../../CONTEXT.md), and the logger modules with the final implementation.

This is a human-signoff slice because the outcome is not just code merged, but a documented claim that the final system satisfies the **Application Logger**, **Log Configuration**, **Log Redaction**, **Request Diagnostics Logging**, and **Planning Request Context** terminology and behavior promised by the PRD.

## Acceptance criteria

- [ ] Focused test suites and the logging integration test pass for the final implementation.
- [ ] Compliance searches confirm no direct `consola` imports outside the shared logger module and no raw request-path `x-trace-id` reads outside trace-resolution ownership.
- [ ] [README.md](../../README.md) and [CONTEXT.md](../../CONTEXT.md) describe the final **Application Logger** behavior and glossary relationships accurately.
- [ ] Logger-module doc comments use the canonical terms **Application Logger**, **Log Configuration**, **Log Level**, **Trace ID**, **Log Redaction**, **Request Diagnostics Logging**, and **Planning Request Context**.
- [ ] The audit outcome is recorded in this issue set or linked artifact with explicit human sign-off that the PRD is satisfied.

## Blocked by

- [Issue 01: Request Diagnostics Logging follows resolved Log Configuration](./issue-01-request-diagnostics-log-configuration.md)
- [Issue 02: Application Logger enforces Log Redaction before output](./issue-02-application-logger-redaction-boundary.md)
- [Issue 03: Planning request logs always use the Request Context Trace ID](./issue-03-planning-request-trace-id-propagation.md)
- [Issue 04: Recipe unexpected-error logs keep Trace ID correlation](./issue-04-recipe-trace-id-unexpected-errors.md)

## Labels

- needs-triage

## Type

HITL

## User stories covered

6, 15, 16, 17, 18
