## What to build

Align project documentation with Logging V2 behavior and language so future implementation and operations remain consistent. Document the operational controls (`LOG_LEVEL`, `LOG_JSON`), Trace ID behavior, event naming contract, diagnostics policy, and redaction expectations.

## Acceptance criteria

- [ ] Documentation explains Log Level defaults, accepted values, and invalid-value fallback behavior.
- [ ] Documentation explains LOG_JSON behavior and operational switching.
- [ ] Documentation captures Trace Header Precedence and Request Context Trace ID behavior.
- [ ] Documentation captures structured event naming (`domain.action`) and redaction guarantees.
- [ ] Documentation reflects debug-only metadata diagnostics policy and no-body default.

## Blocked by

- `issue-05-one-pass-server-migration.md`
- `issue-06-logging-verification-suite.md`
