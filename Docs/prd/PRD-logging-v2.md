# PRD: Unified Server Logging and Runtime Log Controls

## Problem Statement

The server-side logging behavior is currently inconsistent and too hard to operate safely across environments. Logging calls are not fully standardized, log verbosity is not centrally controlled, traceability across request flows is uneven, and there is no single contract for structured event logging and sensitive-data redaction. This makes production debugging slower, increases risk of leaking secrets/PII, and creates avoidable drift between modules.

## Solution

Introduce a single Application Logger contract for all server code, backed by `consola`, with environment-variable driven Log Configuration. The system supports safe runtime control of Log Level (`debug | info | warn | error`) and Log Format (`LOG_JSON=true|false`), enforces structured events with Trace ID correlation, and applies centralized Log Redaction before output. All server modules use the shared logger wrapper and no longer import `consola` directly.

## User Stories

1. As a backend developer, I want one Application Logger interface, so that I do not reinvent logging patterns in each module.
2. As a backend developer, I want a canonical Log Event Name format (`domain.action`), so that logs are searchable and consistent.
3. As a backend developer, I want Request Context Trace ID available automatically, so that I do not thread trace identifiers through every function signature.
4. As a backend developer, I want Trace Header Precedence (`x-trace-id`, then `x-request-id`, then generated UUID), so that upstream tracing systems integrate without custom glue code.
5. As a backend developer, I want structured payload logging, so that I can attach diagnostics without brittle string parsing.
6. As a backend developer, I want a hard rule against direct logger imports, so that the logging contract cannot drift over time.
7. As an operator, I want to set LOG_LEVEL at deploy/runtime, so that I can increase or reduce verbosity without code changes.
8. As an operator, I want invalid LOG_LEVEL values to fail safe, so that bad configuration does not break service behavior.
9. As an operator, I want predictable defaults by Execution Environment, so that local and production behavior is understandable.
10. As an operator, I want LOG_JSON to control output format with a boolean env var, so that I can switch between human-readable and machine-ingestable logs quickly.
11. As a security-conscious maintainer, I want central Log Redaction, so that secrets and PII are protected even when callers forget sanitization.
12. As a security-conscious maintainer, I want request diagnostics to avoid bodies by default, so that sensitive payload content is not leaked in logs.
13. As a production on-call engineer, I want important domain events and errors always logged, so that critical incidents remain visible at normal verbosity.
14. As a production on-call engineer, I want request/response diagnostics only at debug level, so that production logs stay high-signal and affordable.
15. As a QA engineer, I want unit tests for logging configuration and redaction behavior, so that regressions are detected quickly in CI.
16. As a QA engineer, I want an integration test proving middleware Trace ID propagation into emitted logs, so that request-level observability is verified end-to-end.
17. As a future contributor, I want documented logging terminology in CONTEXT, so that implementation choices remain aligned with project language.
18. As a release manager, I want the migration completed in one pass without legacy toggle branches, so that maintenance complexity does not increase.
19. As a developer debugging recipe ingestion issues, I want trace-linked warnings/errors across layers, so that cross-module causality is easy to follow.
20. As a maintainer, I want startup warning behavior for invalid LOG_LEVEL, so that misconfiguration is visible but non-disruptive.

## Implementation Decisions

- **Logger foundation**
  - Standardize on `consola` as the logging backend.
  - Introduce a shared logger module as the only public logging entry point for server code.
  - Enforce a hard rule: no direct `consola` imports outside the shared logger module.

- **Log Configuration behavior**
  - Source of truth is environment variables only.
  - Accepted Log Level values are `debug`, `info`, `warn`, `error`.
  - Invalid Log Level values fall back safely to environment defaults and emit one startup warning.
  - Execution Environment defaults:
    - `development` => `debug`
    - `production` => `info`
  - Log Format is controlled by `LOG_JSON` (`true` => JSON, otherwise pretty output).

- **Traceability model**
  - Resolve inbound Trace ID with precedence: `x-trace-id` -> `x-request-id` -> generated UUID.
  - Store resolved Trace ID in request context for downstream access.
  - Attach Trace ID automatically to request-scoped structured log entries.

- **Structured logging contract**
  - Standardize event naming as `domain.action` in snake_case.
  - Use structured payloads with stable top-level fields (including trace identity and event name).
  - Default request diagnostics are metadata-only (method/path/status/duration and related metadata), with no body logging.

- **Redaction and safety**
  - Apply centralized Log Redaction in the shared logger before output.
  - Redaction covers these case-insensitive keys: `password`, `token`, `secret`, `authorization`, `auth`, `apikey`, `api_key`, `credential`, `credentials`, `ssn`, `credit_card`, `cvv`, and `pin`.
  - Caller discipline is not relied on for safe output.

- **Rollout shape**
  - Perform full migration in one pass rather than incremental adoption.
  - No legacy kill-switch is introduced for this initiative.

- **Deep modules to build/strengthen**
  - **Log Configuration Resolver**: parses/validates env inputs and yields final level/format policy.
  - **Trace Context Resolver**: isolates trace header precedence and context storage logic.
  - **Structured Logger Facade**: minimal stable interface for event logging, level routing, and redaction.
  - **Request Diagnostics Emitter**: emits debug-only metadata logs around request lifecycle without body leakage.

## Testing Decisions

- **What makes a good test**
  - Test externally observable behavior and contracts, not internals or implementation-specific call sequences.
  - Assert outcomes at the logging boundary: selected level, selected format mode, redaction result, trace propagation result, and diagnostics gating by level.
  - Keep fixtures realistic but minimal; avoid coupling tests to unstable textual formatting details where possible.

- **Modules to test**
  - Log Configuration Resolver:
    - valid/invalid LOG_LEVEL handling
    - environment defaults by Execution Environment
    - startup warning behavior on invalid values
    - LOG_JSON parsing behavior
  - Structured Logger Facade:
    - event naming shape acceptance
    - redaction of sensitive payload keys
    - level-gated emission behavior
  - Trace Context Resolver + request middleware integration:
    - header precedence resolution
    - generated Trace ID fallback
    - request context storage
    - emitted entries include Trace ID
  - Request Diagnostics Emitter:
    - emitted only at debug level
    - metadata-only output (no request/response bodies)

- **Prior art in the codebase**
  - Follow existing unit-test style already used across server utilities and API contracts.
  - Mirror current project testing conventions (Vitest unit tests and targeted behavior assertions) when adding logger-focused and integration-oriented tests.

## Out of Scope

- Shipping logs to external observability backends, dashboards, or alert routing.
- Defining retention, sampling, or cost-optimization policy at infrastructure level.
- Frontend/browser logging unification.
- Runtime hot-reload of logging config without process restart.
- Distributed tracing standards beyond header precedence and Trace ID propagation in this service.
- Historical log migration or backfill.

## Further Notes

- This PRD reflects decisions already resolved in the current planning session and codified in the project context language.
- The terminology intentionally distinguishes Execution Environment from Log Level to avoid future ambiguity.
- The one-pass migration plus hard wrapper rule optimizes for long-term consistency over short-term convenience.
