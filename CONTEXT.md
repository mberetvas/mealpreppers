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

- **Saved Weekplans**: `GET` / `POST` `/api/v1/saved-weekplans`, `GET` / `PATCH` / `DELETE` `/api/v1/saved-weekplans/:id`, plus anonymous merge preview and merge routes as needed. Legacy unscoped `/api/v1/planning/week-templates` was retired (May 2026).
- Architecture decision: [ADR 0001 — Saved Weekplans single persistence](docs/adr/0001-saved-weekplans-single-persistence.md).

### Navigation (manage surface)

- **Desktop** top navigation includes **Saved Weekplans** (`/saved-weekplans`).
- **Mobile** bottom bar focuses Recipes, Plan, Shopping List, and More; the **More** hub lists the same primary destinations as desktop, including Saved Weekplans.

## Recipe Catalog

**Public Recipe Catalog**:
All Recipe Catalog entries are publicly readable. `GET /api/v1/recipes/:id` performs no **Planning Principal** check by design — any client may fetch any recipe without authentication. This keeps the catalog a shared reference layer that the Shopping list and Planner consume without ownership constraints.
_Future consideration_: any batch endpoint or private-recipe feature must revisit visibility enforcement consistent with the requesting **Planning Principal**.
_Avoid_: per-user recipe gating (unless explicitly designed)

## Shopping list

Vocabulary for the shopping list page (`/shopping-list?plan=…`), which is built from one **Saved Weekplan** and the **Public Recipe Catalog**.

**Shopping list**:
Ingredients for all meals in a **Saved Weekplan**, grouped into **recipe sections** (one block per distinct recipe in slot order), with quantities scaled by how often that recipe appears in the week grid.
_Avoid_: grocery list, pantry list (when meaning this page)

**Recipe section**:
One recipe’s ingredient lines on the shopping list, including an occurrence badge when the same recipe appears in multiple slots.
_Avoid_: aisle, category

**Shopping list plan link**:
The `plan` query parameter (Saved Weekplan id) that selects which persisted week grid to load.
_Avoid_: template id (retired product term)

**Shopping list empty plan**:
The plan loaded successfully but every meal slot has no recipe — not a fetch failure.
_Avoid_: no ingredients, load error

**Shopping list recipe resolution failure**:
One or more catalog recipes referenced by the plan could not be loaded; successful recipes still appear in **recipe sections**.
_Avoid_: plan error (plan access succeeded)

**Shopping list total recipe resolution failure**:
Every referenced recipe failed to load; the plan title is shown, a warning banner notes the failure, and a dedicated empty message explains that no list could be built (distinct from **Shopping list empty plan** and from plan access errors).
_Avoid_: plan could not be loaded

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
- A **Shopping list** is built from exactly one **Saved Weekplan** selected by **Shopping list plan link**
- **Recipe section** order follows week-grid slot traversal (day ascending, breakfast → lunch → dinner), not alphabetical merge across recipes
- **Shopping list empty plan** requires zero recipe slots; partial or **total recipe resolution failure** still means the plan had recipe ids
- **Shopping list total recipe resolution failure** keeps the loaded plan visible; it does not use the same UI as a missing or forbidden **Saved Weekplan**

## Example dialogue

> **Dev:** "Should we run at `prod` level in staging?"
> **Domain expert:** "`production` is the **Execution Environment**; choose a **Log Level** like `info` separately."

> **Dev:** "We set `SUPABASE_URL` to the Docker gateway hostname; recipe images 404 in the browser."
> **Domain expert:** "Server traffic uses the **Supabase server origin**; URLs returned to the client must use the **Supabase browser origin** on `localhost`."

> **Dev:** "All recipe fetches failed — should we show ‘Plan could not be loaded’?"
> **Domain expert:** "No. The **Saved Weekplan** loaded. Show **shopping list total recipe resolution failure**: warning plus an empty-state message, not plan access error."

## Flagged ambiguities

- "`prod` level" was used to mean a **Log Level**; resolved: use **Execution Environment** (`production`) and **Log Level** as separate terms.
- A single `SUPABASE_URL` was used for both server calls and browser-loaded Storage URLs; resolved: distinguish **Supabase server origin** from **Supabase browser origin** when those origins cannot be the same string (typical under Docker Compose).
