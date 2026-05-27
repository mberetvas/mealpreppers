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

Architecture decisions:
- [ADR 0002 — Shopping list AI consolidation](Docs/adr/0002-shopping-list-ai-consolidation.md).
- [ADR 0003 — Shopping list human review and persistence](docs/adr/0003-shopping-list-human-review-and-persistence.md).

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

**Shopping list store walk order**:
The default line order for a **Consolidated shopping list** only (not **Recipe sections view**): supermarket-area sequence (produce → bakery → meat → fish → dairy → frozen → dry goods → spices → canned/sauces → oils → beverages → other), then alphabetical by ingredient name within each area (Dutch locale). Applied server-side whenever consolidated lines are returned or displayed (consolidate, saved-list load, baseline fallback); does not rename lines or add UI section headers. Older saved lists are re-sorted on load without re-consolidating.
_Avoid_: recipe section order, aisle (when meaning **Recipe section**), category headers

**Shopping list spice area**:
Dried spices and seasonings (e.g. paprikapoeder, kerriepoeder) in the **Shopping list store walk order**; distinct from fresh herbs in produce and from bulk **dry goods**.
_Avoid_: spice rack UI label, herb (when fresh produce)

**Shopping list sauce area (walk order)**:
Jarred/tubed sauces and pastes (e.g. tomatenpuree, pesto) grouped under the canned/sauces step of **Shopping list store walk order** via keyword rules—not a separate UI section.
_Avoid_: spice area, recipe section

**Shopping list consolidation**:
AI-first derivation of a **Consolidated shopping list**: the model receives unmerged **Recipe section** ingredients, merges and sorts the full store-ready list; **Shopping list exact merge** is fallback-only when AI is unavailable or fails.
_Avoid_: AI shopping list, smart list

**Shopping list exact merge**:
Deterministic fallback merge when **Shopping list AI polish** cannot run; combines lines only when normalized ingredient name and unit are identical (including shared unit aliases such as `gr` → `g`).
_Avoid_: fuzzy merge, synonym merge

**Shopping list AI polish**:
Primary **Shopping list consolidation** step; the model merges recipe-grouped ingredients (names, units, quantities), sorts by **Shopping list store walk order**, and returns the full consolidated list for human review.
_Avoid_: leftover-only merge, fuzzy pass

**Shopping list cross-unit merge**:
Legacy deterministic utility (g↔kg, ml↔dl↔l) retained for harness quantity-cap math; not part of the consolidation happy path.
_Avoid_: pre-AI pipeline step, fuzzy synonym merge

**Shopping list polish baseline**:
Flat source snapshot of all recipe ingredient rows (`{recipeId}:{index}` ids) used by the harness to validate **Shopping list AI polish** (quantity caps, invented ids, removed lines).
_Avoid_: post–exact-merge only, cross-unit merged list

**Shopping list consolidation context**:
Recipe-grouped payload for **Shopping list AI polish** (sections with stable per-ingredient ids); not the merged L{n} baseline.
_Avoid_: polish baseline, exact-merge lines only

**Shopping list polish diff**:
UI indication of lines that differ between the **Shopping list polish baseline** and the **Consolidated shopping list** after AI polish.
_Avoid_: changelog, merge report

**Consolidate action**:
The explicit control in **Consolidated shopping list** view that starts **Shopping list consolidation**; switching **Shopping list view mode** alone does not run consolidation.
_Avoid_: auto-consolidate, merge on open

**Shopping list consolidation service**:
Server-side orchestration that loads the **Saved Weekplan**, resolves catalog recipes, builds **Shopping list consolidation context**, invokes **Shopping list AI polish**, and returns `pending_review` for human approval; on failure uses **Shopping list exact merge** fallback.
_Avoid_: client-side merge API, browser LLM

**Shopping list polish response**:
Structured model output for consolidation: consolidated `lines` plus optional `changes` explaining edits against the **Shopping list polish baseline** (for harness validation and **Shopping list polish diff**).
_Avoid_: markdown list, free text

**Shopping list polish fallback**:
When **Shopping list AI polish** cannot run (missing API key, timeout, parse error), the UI falls back to the **Shopping list exact merge** result (aisle-sorted) with a warning. Harness rule violations no longer trigger fallback; they produce **Shopping list polish hint**s during **Shopping list polish review** instead.
_Avoid_: harness reject hides AI output, hard fail empty view

**Shopping list unit policy (v2)**:
**Shopping list cross-unit merge** converts g↔kg and ml↔dl↔l deterministically. **Shopping list AI polish** may use the same conversions within a dimension but must not convert mass↔volume or mass↔count; `el`↔`ml` is not supported.
_Avoid_: smart units across dimensions, AI-only conversion

**Shopping list name policy (v2)**:
**Shopping list AI polish** may merge human-style name variants (e.g. preparation suffixes); renames surface as **info**-level **Shopping list polish hint**s, not harness blockers.
_Avoid_: verbatim-only names in AI output

**Consolidated shopping list persistence**:
User-confirmed **Consolidated shopping list** is stored on the **Saved Weekplan** and reused on later visits until the plan’s shopping source changes; otherwise the user runs **Consolidate action** again.
_Avoid_: session-only cache, ephemeral merge row

**Saved consolidated shopping list**:
The **Consolidated shopping list** the user confirmed after **Shopping list polish review**, stored on the **Saved Weekplan** so repeat visits do not require re-running **Consolidate action** when the underlying plan is unchanged.
_Avoid_: session cache, ephemeral merge

**Shopping list source fingerprint**:
A server-computed digest of canonical **Saved Weekplan** `body` (stable JSON: sorted keys, days `1`–`7`, normalized slots). Stored on save and recomputed on load; the client never supplies or trusts its own hash. Mismatch → **Deprecated saved consolidated shopping list**.
_Avoid_: client hash, raw JSON.stringify, updated_at only

**Shopping list polish review layout**:
Desktop: **Recipe sections view** reference left, editable AI column right. Mobile: stacked, reference on top.
_Avoid_: side-by-side on small screens, single column only

**Shopping list polish review order**:
On entering **Shopping list polish review**, editable lines are sorted once using **Shopping list store walk order**; order stays fixed while the user edits until confirm. After confirm, consolidated display continues to use **Shopping list store walk order** on every serve (re-sort allowed).
_Avoid_: live re-sort on every field change, model submission order as final store order

**Deprecated saved consolidated shopping list**:
A **Saved consolidated shopping list** whose **Shopping list source fingerprint** no longer matches the current **Saved Weekplan** `body`; the UI warns the user, shows the old lines read-only for comparison, and requires **Consolidate action** before a new list can be confirmed.
_Avoid_: stale badge only, silent overwrite, hidden history

**Saved consolidated shopping list record**:
JSON stored on the **Saved Weekplan** row: confirmed `lines`, `sourceFingerprint` (hash of `body`), and `confirmedAt`.
_Avoid_: separate shopping-list table, session storage

**Consolidated shopping list API**:
`PUT /api/v1/saved-weekplans/:id/consolidated-shopping-list` persists after **Shopping list polish confirm**; `GET` on the same path loads the full record. **Saved Weekplan** `GET` embeds `hasSavedShoppingList` and `shoppingListDeprecated` only. **Consolidate action** (`POST .../consolidate-shopping-list`) returns polish for review; saving is always a separate call.
_Avoid_: nested plan PATCH, confirm-on-consolidate

**Consolidated shopping list default view**:
When a valid **Saved consolidated shopping list** exists, **Consolidated shopping list** view shows it as the active list; **Shopping list polish review** appears only after **Consolidate action** (or an explicit edit flow).
_Avoid_: always-on review, auto-consolidate on open

**Shopping list polish review status**:
`POST consolidate` returns `pending_review` when the model succeeds and the client should show **Shopping list polish review** (with `polishResponse` and hints), distinct from `polished` after **PUT** save or legacy auto-apply.
_Avoid_: baseline_fallback for harness, ambiguous polishStatus

**Edit saved consolidated shopping list**:
**Edit list** reopens **Shopping list polish review** with the **Saved consolidated shopping list** lines editable; **Confirm** persists via **PUT** without a new OpenRouter call.
_Avoid_: consolidate required for typos, read-only saved list

**Shopping list polish retry policy (v1)**:
On parse failure, **Shopping list consolidation service** does not re-call the model. Harness validation does not block the response; hints are returned for human review. Network/timeout failures still use **Shopping list polish fallback** without review.
_Avoid_: repair loop, auto-retry, server-side harness gate

**Shopping list consolidation access**:
The same **Planning Principal** rules as loading the **Saved Weekplan** for the shopping list; anonymous session owners may consolidate their own plans.
_Avoid_: sign-in required, public consolidate

**Shopping list partial consolidation**:
**Consolidate action** is allowed when **Shopping list recipe resolution failure** left some recipes unloaded; consolidation uses only loaded **Recipe section**s and keeps the incomplete warning visible.
_Avoid_: block consolidate, all-or-nothing merge

**Shopping list polish reference**:
During human review of **Shopping list AI polish**, the left pane shows **Recipe sections view** (per-recipe source ingredients).
_Avoid_: polish baseline tab, cross-unit reference column

**Shopping list polish review**:
After **Consolidate action** succeeds at the model, the UI always enters review: editable AI column beside recipe-section reference; harness issues are inline **Shopping list polish hint**s. The user **Approves** the edited list to persist the **Consolidated shopping list** (`polished` status).
_Avoid_: auto-apply polish, polished view before approve

**Shopping list polish hint**:
A non-blocking warning on an editable AI line when it still violates a harness rule (e.g. name-unchanged, unit-conversion, quantity cap); the user may fix or ignore before confirm.
_Avoid_: validation error modal, hard reject

**Shopping list polish confirm**:
The user **Approves** their edited AI column to the session **Consolidated shopping list** (persisted via PUT). Editing is limited to `name`, `quantity`, and `unit` on existing line ids. If **error**-level **Shopping list polish hint**s remain, Approve requires acknowledging each hint.
_Avoid_: auto-confirm, server harness gate

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
- **Shopping list AI polish** receives **Shopping list consolidation context** (recipe-grouped unmerged ingredients)
- **Shopping list consolidation service** owns AI polish with exact-merge fallback; the page does not post ingredient payloads for consolidation
- **Shopping list AI polish** must return a **Shopping list polish response** (JSON lines + optional changes), not prose or markdown
- On AI polish failure, **Shopping list polish fallback** applies: baseline visible, retry available
- **Shopping list unit policy (v2)** allows deterministic and AI unit conversion only within g↔kg and ml↔dl↔l; never mass↔volume or mass↔count
- **Shopping list name policy (v2)** allows AI name cleanup; renames surface as info-level **Shopping list polish hint**s, not harness failures
- **Consolidated shopping list persistence** stores user-confirmed lists on the **Saved Weekplan**; ephemeral-only behavior (ADR 0002 v1) is superseded by ADR 0003
- **Shopping list polish retry policy (v1)** is single-attempt AI; failures go straight to **Shopping list polish fallback**
- **Shopping list consolidation access** mirrors **Saved Weekplan** read access for the linked plan
- **Shopping list partial consolidation** applies under **Shopping list recipe resolution failure**; missing recipes are excluded, not fatal
- **Shopping list consolidation** is AI-first; **Shopping list exact merge** runs only on fallback (`ai_skipped`, `baseline_fallback`)
- **Shopping list exact merge** never merges lines with different normalized names or units
- **Shopping list AI polish** performs merge, unit conversion (g↔kg, ml↔dl↔l), name cleanup, and aisle sorting in one pass
- Successful **Consolidate action** always returns `pending_review`; `polished` applies after user **Approve** and PUT save
- The consolidation harness validates against the source ingredient snapshot (invented ids, removed lines, quantity caps); name changes are hints only
- **Shopping list polish diff** compares **Consolidated shopping list** to **Shopping list polish baseline** for user trust

## Example dialogue

> **Dev:** "Should we run at `prod` level in staging?"
> **Domain expert:** "`production` is the **Execution Environment**; choose a **Log Level** like `info` separately."

> **Dev:** "We set `SUPABASE_URL` to the Docker gateway hostname; recipe images 404 in the browser."
> **Domain expert:** "Server traffic uses the **Supabase server origin**; URLs returned to the client must use the **Supabase browser origin** on `localhost`."

> **Dev:** "All recipe fetches failed — should we show ‘Plan could not be loaded’?"
> **Domain expert:** "No. The **Saved Weekplan** loaded. Show **shopping list total recipe resolution failure**: warning plus an empty-state message, not plan access error."

> **Dev:** "Can the model rename `400 g pasta` from the recipe ingredients?"
> **Domain expert:** "Yes. **Shopping list AI polish** receives unmerged per-recipe ingredients and may clean up names; renames surface as info-level **Shopping list polish hint**s."

## Flagged ambiguities

- Early design assumed AI only on unmerged leftovers; resolved: **Shopping list AI polish** covers the full post–exact-merge list.
- Full AI polish requires a visible **Shopping list polish diff** and baseline-aware server validation, not schema-only acceptance.

- "`prod` level" was used to mean a **Log Level**; resolved: use **Execution Environment** (`production`) and **Log Level** as separate terms.
- A single `SUPABASE_URL` was used for both server calls and browser-loaded Storage URLs; resolved: distinguish **Supabase server origin** from **Supabase browser origin** when those origins cannot be the same string (typical under Docker Compose).
