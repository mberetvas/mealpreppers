# Mealprepper

Mealprepper is a recipe and meal-planning application. This context captures canonical language decisions made during implementation discussions.

## Language

**Execution Environment**:
The runtime mode of the app, currently `development` or `production`.
_Avoid_: prod level, debug environment

**Log Level**:
The verbosity threshold for emitted logs, such as `debug`, `info`, `warn`, or `error`.
_Avoid_: prod, dev mode

**Application Logger**:
The project-wide logging implementation used by server code.
_Avoid_: per-file custom logger

**Log Configuration**:
The environment-variable based policy that selects and validates the active **Log Level** and **Log Format** from `LOG_LEVEL` and `LOG_JSON`.
_Avoid_: runtime-config logger switch

**Log Format**:
The output representation of logs, switchable between pretty text and JSON.
_Avoid_: prod format, debug format

**Trace ID**:
A per-request identifier propagated through logs for correlation.
_Avoid_: request token, debug id

**Trace Header Precedence**:
The ordered policy for resolving inbound trace identity from request headers.
_Avoid_: random header fallback

**Request Context Trace ID**:
The resolved **Trace ID** stored on request context for handler and service access.
_Avoid_: per-function trace argument

**Log Event Name**:
The canonical identifier for a logged action, formatted as `domain.action` in snake_case.
_Avoid_: free-form message-only events

**Log Redaction**:
The mandatory removal or masking of secrets and PII from structured log payloads before emission.
_Avoid_: caller-managed sanitization

**Request Diagnostics Logging**:
Detailed request/response logging used for deep troubleshooting at debug level.
_Avoid_: always-on request dumps

## Relationships

- An **Execution Environment** determines the default **Log Level**
- The **Application Logger** emits messages filtered by the active **Log Level**
- **Log Configuration** accepts only `debug`, `info`, `warn`, or `error` for `LOG_LEVEL`
- Invalid `LOG_LEVEL` falls back safely to `debug` outside `production` or `info` in `production`, with one startup warning
- **Log Configuration** resolves **Log Format** from `LOG_JSON`, where only `true` enables JSON output
- **Trace Header Precedence** resolves **Trace ID** using `x-trace-id`, then `x-request-id`, then generated UUID
- The resolved **Trace ID** is stored as **Request Context Trace ID**
- The resolved **Trace ID** is also echoed as the `x-trace-id` response header
- Every structured entry includes a **Log Event Name**
- **Log Redaction** is applied to every structured entry before output for sensitive keys such as `password`, `token`, `secret`, `authorization`, `auth`, `apikey`, `api_key`, `credential`, `credentials`, `ssn`, `credit_card`, `cvv`, and `pin`
- **Request Diagnostics Logging** is emitted only when **Log Level** is `debug`
- **Request Diagnostics Logging** is metadata-only by default and excludes request and response bodies
- A **Trace ID** is attached to request-scoped entries emitted by the **Application Logger**

## Example dialogue

> **Dev:** "Should we run at `prod` level in staging?"
> **Domain expert:** "`production` is the **Execution Environment**; choose a **Log Level** like `info` separately."

## Flagged ambiguities

- "`prod` level" was used to mean a **Log Level**; resolved: use **Execution Environment** (`production`) and **Log Level** as separate terms.
