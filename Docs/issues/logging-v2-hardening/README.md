# Issues: Logging v2 hardening (local)

Parent: [PRD: Unified Server Logging and Runtime Log Controls](../../prd/PRD-logging-v2.md)

Vertical slices are numbered in dependency order. Each file is ready to paste into an external tracker. Local tracker label intent for every slice: `needs-triage`.

| # | File | Type |
|---|------|------|
| 01 | [issue-01-request-diagnostics-log-configuration.md](./issue-01-request-diagnostics-log-configuration.md) | AFK |
| 02 | [issue-02-application-logger-redaction-boundary.md](./issue-02-application-logger-redaction-boundary.md) | AFK |
| 03 | [issue-03-planning-request-trace-id-propagation.md](./issue-03-planning-request-trace-id-propagation.md) | AFK |
| 04 | [issue-04-recipe-trace-id-unexpected-errors.md](./issue-04-recipe-trace-id-unexpected-errors.md) | AFK |
| 05 | [issue-05-logging-v2-compliance-closeout.md](./issue-05-logging-v2-compliance-closeout.md) | HITL |

Suggested dependency chain: `(01, 02, 03, 04 parallel) -> 05`.
