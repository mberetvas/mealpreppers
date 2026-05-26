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

Architecture decision: [ADR 0002 — Shopping list AI consolidation](Docs/adr/0002-shopping-list-ai-consolidation.md).

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

**Recipe sections view**:
The default **Shopping list** layout: ingredients grouped by **Recipe section**.
_Avoid_: detail view, by-recipe view

**Shopping list view mode**:
Whether the page shows **Recipe sections view** or **Consolidated shopping list**; driven by an in-page control and reflected in the URL (`view=consolidated` when consolidated; omitted or other value for recipe sections).
_Avoid_: tab, layout switch

**Consolidated shopping list**:
A single store-oriented ingredient list for the same **Saved Weekplan**, with duplicates merged and quantities combined, produced from the current **Shopping list** data.
_Avoid_: normalized list (overlaps recipe-ingestion wording), grocery list

**Shopping list consolidation**:
A two-step derivation of a **Consolidated shopping list**: **Shopping list exact merge** first, then an AI polish pass over the full candidate list (may re-group, rename, and adjust lines—including rows already merged programmatically).
_Avoid_: AI shopping list, smart list

**Shopping list exact merge**:
The programmatic step of **Shopping list consolidation**; combines lines only when normalized ingredient name and unit are identical (including shared unit aliases such as `gr` → `g`).
_Avoid_: fuzzy merge, synonym merge

**Shopping list AI polish**:
The second step of **Shopping list consolidation**; the model may refine the entire post–exact-merge list (names, grouping, quantities where units align)—not limited to leftover unmerged lines.
_Avoid_: leftover-only merge, fuzzy pass

**Shopping list polish baseline**:
The ingredient list immediately after **Shopping list exact merge**; used by the server harness to validate **Shopping list AI polish** and by the UI to show what changed.
_Avoid_: raw list, pre-AI snapshot

**Shopping list polish diff**:
UI indication of lines that differ between the **Shopping list polish baseline** and the **Consolidated shopping list** after AI polish.
_Avoid_: changelog, merge report

**Consolidate action**:
The explicit control in **Consolidated shopping list** view that starts **Shopping list consolidation**; switching **Shopping list view mode** alone does not run consolidation.
_Avoid_: auto-consolidate, merge on open

**Shopping list polish context**:
The payload for **Shopping list AI polish**: exact-merge lines plus provenance (which **Recipe section** each line came from), not the full pre-merge section tree alone.
_Avoid_: full prompt dump, raw catalog blob

**Shopping list consolidation service**:
Server-side orchestration that loads the **Saved Weekplan**, resolves catalog recipes, runs **Shopping list exact merge**, then **Shopping list AI polish**; the client triggers it via **Consolidate action** and renders the result.
_Avoid_: client-side merge API, browser LLM

**Shopping list polish response**:
Structured model output for consolidation: consolidated `lines` plus optional `changes` explaining edits against the **Shopping list polish baseline** (for harness validation and **Shopping list polish diff**).
_Avoid_: markdown list, free text

**Shopping list polish fallback**:
When **Shopping list AI polish** fails, the UI still shows the **Shopping list polish baseline** as the **Consolidated shopping list**, with a warning and retry—not an empty consolidated view.
_Avoid_: hard fail, merge error only

**Shopping list unit policy (v1)**:
**Shopping list AI polish** may merge or rename only when units already match; no unit conversion in the first release.
_Avoid_: smart units, auto-convert

**Shopping list polish locale (v1)**:
Canonical ingredient names and `changes` rationale from **Shopping list AI polish** are Dutch store-style labels, regardless of mixed input languages.
_Avoid_: auto-detect language, English defaults

**Consolidated shopping list persistence (v1)**:
The consolidated result is not stored on the **Saved Weekplan**; each **Consolidate action** derives it again (client may hold it only for the current session).
_Avoid_: saved consolidated list, cached merge row

**Shopping list polish retry policy (v1)**:
On parse or harness validation failure, **Shopping list consolidation service** does not re-call the model; it applies **Shopping list polish fallback** immediately.
_Avoid_: repair loop, auto-retry

**Shopping list consolidation access**:
The same **Planning Principal** rules as loading the **Saved Weekplan** for the shopping list; anonymous session owners may consolidate their own plans.
_Avoid_: sign-in required, public consolidate

**Shopping list partial consolidation**:
**Consolidate action** is allowed when **Shopping list recipe resolution failure** left some recipes unloaded; consolidation uses only loaded **Recipe section**s and keeps the incomplete warning visible.
_Avoid_: block consolidate, all-or-nothing merge

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
- A **Shopping list** is shown in **Recipe sections view** by default; **Consolidated shopping list** is an alternate **Shopping list view mode** of the same loaded data
- **Shopping list view mode** is selected in the UI and synced to the URL so refresh and shared links preserve the mode
- **Shopping list consolidation** runs only after **Consolidate action**, not when entering consolidated view mode
- **Shopping list AI polish** receives **Shopping list polish context** (baseline lines with recipe provenance)
- **Shopping list consolidation service** owns exact merge and AI polish; the page does not post ingredient payloads for consolidation
- **Shopping list AI polish** must return a **Shopping list polish response** (JSON lines + optional changes), not prose or markdown
- On AI polish failure, **Shopping list polish fallback** applies: baseline visible, retry available
- **Shopping list unit policy (v1)** forbids AI unit conversion; different units remain separate lines
- **Shopping list polish locale (v1)** requires Dutch canonical names in **Shopping list polish response**
- **Consolidated shopping list persistence (v1)** is ephemeral; no DB column for consolidated output in the first release
- **Shopping list polish retry policy (v1)** is single-attempt AI; failures go straight to **Shopping list polish fallback**
- **Shopping list consolidation access** mirrors **Saved Weekplan** read access for the linked plan
- **Shopping list partial consolidation** applies under **Shopping list recipe resolution failure**; missing recipes are excluded, not fatal
- **Shopping list consolidation** always runs **Shopping list exact merge** before **Shopping list AI polish**
- **Shopping list exact merge** never merges lines with different normalized names or units
- **Shopping list AI polish** may change any line produced by **Shopping list exact merge**, not only unmerged leftovers
- The consolidation harness rejects or clamps AI output that invents ingredients or increases quantities beyond the **Shopping list polish baseline** sums per name and unit
- **Shopping list polish diff** compares **Consolidated shopping list** to **Shopping list polish baseline** for user trust

## Example dialogue

> **Dev:** "Should we run at `prod` level in staging?"
> **Domain expert:** "`production` is the **Execution Environment**; choose a **Log Level** like `info` separately."

> **Dev:** "We set `SUPABASE_URL` to the Docker gateway hostname; recipe images 404 in the browser."
> **Domain expert:** "Server traffic uses the **Supabase server origin**; URLs returned to the client must use the **Supabase browser origin** on `localhost`."

> **Dev:** "All recipe fetches failed — should we show ‘Plan could not be loaded’?"
> **Domain expert:** "No. The **Saved Weekplan** loaded. Show **shopping list total recipe resolution failure**: warning plus an empty-state message, not plan access error."

> **Dev:** "Can the model rename `400 g pasta` after exact merge?"
> **Domain expert:** "Yes. **Shopping list AI polish** may refine the full list; exact merge is a trusted baseline input, not frozen output."

## Flagged ambiguities

- Early design assumed AI only on unmerged leftovers; resolved: **Shopping list AI polish** covers the full post–exact-merge list.
- Full AI polish requires a visible **Shopping list polish diff** and baseline-aware server validation, not schema-only acceptance.

- "`prod` level" was used to mean a **Log Level**; resolved: use **Execution Environment** (`production`) and **Log Level** as separate terms.
- A single `SUPABASE_URL` was used for both server calls and browser-loaded Storage URLs; resolved: distinguish **Supabase server origin** from **Supabase browser origin** when those origins cannot be the same string (typical under Docker Compose).
