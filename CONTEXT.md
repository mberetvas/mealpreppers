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

## Planning

Vocabulary for weekly meal grids, persistence, and accounts. Product copy uses these names even when internal storage or legacy HTTP paths still say “week template.”

**Saved Weekplan**:
A **persisted** weekly meal grid (the `WeekPlanV1` document) plus a human-readable **title** and server metadata (`id`, timestamps). It belongs to the **current principal** (signed-in user or anonymous session). This is what users **save** from the planner and manage on the **Manage plans** page (`/saved-weekplans`).

**Draft week plan**:
Planner work that is **not** stored as a Saved Weekplan yet (no create **POST**). It may exist only in the client until the user saves with a valid title.

**Anonymous merge**:
When someone moves from **anonymous** to **authenticated**, choosing to **move** anonymous-owned Saved Weekplans into the account or **discard** them (no silent retention of anonymous-owned rows as “hidden”).

**Anonymous idle purge**:
A scheduled job may **delete anonymous-owned** Saved Weekplans whose **`updated_at`** is older than the configured idle window (approximately 90 days). **Authenticated** users’ Saved Weekplans are **not** selected by that job.

**Planning Principal**:
The current actor for Planning reads and mutations, resolved as either an authenticated user or an anonymous planning session. It scopes access to **Saved Weekplans** and legacy planning records.
_Avoid_: raw bearer lookup, per-handler auth branching

**Planning Request Context**:
The request-scoped module interface used by Planning handlers. It provides the **Request Context Trace ID**, the current **Planning Principal**, and a request-scoped **Application Logger**, and it owns unexpected-error logging for the Planning slice.
_Avoid_: per-handler trace lookup, per-handler principal resolution, ad hoc logger composition

### HTTP API (Saved Weekplans vs legacy)

- **Preferred**: `GET` / `POST` `/api/v1/saved-weekplans`, `GET` / `PATCH` / `DELETE` `/api/v1/saved-weekplans/:id`, plus anonymous merge preview and merge routes as needed. See `server/api/v1/planning/week-templates/DEPRECATED.md` for the staged deprecation note on **`/api/v1/planning/week-templates`** (legacy, unscoped list/get/mutations).

### Navigation (manage surface)

- **Desktop** top navigation includes **Saved Weekplans** (`/saved-weekplans`).
- **Mobile** bottom bar focuses Recipes, Plan, Shopping List, and More; the **More** hub lists the same primary destinations as desktop, including Saved Weekplans.

## Local full-stack (Docker)

Vocabulary for running Mealprepper and Supabase together via Docker Compose on a developer machine. Not intended for internet-facing production.

**Supabase server origin**:
The HTTP origin the Mealprepper **server** uses for the Supabase client when that server runs **inside** the Compose network (reachable via Docker service names, e.g. the API gateway).
_Avoid_: internal URL, private URL

**Supabase browser origin**:
The HTTP origin used when constructing **Supabase Storage** (and similar) URLs **returned to the browser**; it must resolve on the **developer host** (typically `localhost` with a published API port), not only inside the Compose network.
_Avoid_: public URL (overloaded), CORS origin

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
- The **Planning Request Context** includes the **Request Context Trace ID**
- The **Planning Request Context** resolves the current **Planning Principal**
- The **Planning Request Context** provides a request-scoped **Application Logger** for Planning handlers
- A **Draft week plan** becomes a **Saved Weekplan** after a successful first **create** from the planner
- **Anonymous merge** changes ownership of anonymous **Saved Weekplans**; **discard** removes them rather than leaving them anonymous-owned
- **Anonymous idle purge** applies only to rows still tied to an anonymous session, not to authenticated-owned **Saved Weekplans**
- **Supabase browser origin** and **Supabase server origin** may differ under local Compose; both refer to the same Supabase project, but the **browser** must not receive URLs that only work inside the Compose network

## Example dialogue

> **Dev:** "Should we run at `prod` level in staging?"
> **Domain expert:** "`production` is the **Execution Environment**; choose a **Log Level** like `info` separately."

> **Dev:** "We set `SUPABASE_URL` to the Docker gateway hostname; recipe images 404 in the browser."
> **Domain expert:** "Server traffic uses the **Supabase server origin**; URLs returned to the client must use the **Supabase browser origin** on `localhost`."

## Flagged ambiguities

- "`prod` level" was used to mean a **Log Level**; resolved: use **Execution Environment** (`production`) and **Log Level** as separate terms.
- A single `SUPABASE_URL` was used for both server calls and browser-loaded Storage URLs; resolved: distinguish **Supabase server origin** from **Supabase browser origin** when those origins cannot be the same string (typical under Docker Compose).
