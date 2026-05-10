# PRD: Saved Weekplans — Manage Page and Planner Lifecycle

## Problem Statement

Users can build a weekly meal plan in the planner, but the product language and flows still center on “week templates,” and there is no dedicated place to see everything they have saved, recover work, rename plans, or delete old ones. Users need a clear mental model: **draft while editing**, **explicit first save** to persist, then **ongoing autosave** for saved plans—plus a **manage** surface that lists **Saved Weekplans** with predictable sorting and actions. Additionally, the backend currently treats planning rows as **service-role–managed** without end-user ownership; users expect **anonymous persistence** with a path to **attach plans to an account** later, and **cleanup** of abandoned anonymous data.

## Solution

Introduce **Saved Weekplan** as the canonical product term for a persisted weekly grid (`WeekPlanV1` document + title metadata). The **weekly planner** supports **draft mode** (no server row) until the user saves with a **non-empty inline title**; after creation, **debounced autosave** keeps server state in sync. **Navigation** uses **one planner route**: **no identifier = draft**, **with identifier = load that Saved Weekplan**. **Leaving an unsaved draft** uses **in-app confirmation** and **`beforeunload`**, with optional **local recovery snapshot** so refresh does not destroy work.

Add a **manage** page that lists the current user’s **Saved Weekplans**, **sorted by recently updated** by default, with an **ephemeral toggle** between **Updated** and **Name** (no stored preference). Each row supports **Open**, **inline Rename**, and **Delete** with a **simple confirmation**. An **empty list** explains **draft vs saved** and offers a primary **Create a week plan** action into a **draft** planner.

Expose **public HTTP routes** under a **Saved Weekplans** vocabulary (e.g. `/api/v1/saved-weekplans`) that **delegate** to the existing persistence layer initially; **deprecate** legacy `/planning/week-templates` routes after migration.

For **anonymous** sessions: allow **server-backed** Saved Weekplans keyed to an anonymous principal. On **signup or login**, prompt to **move** plans into the authenticated account or **discard** anonymous data. **Purge** inactive **anonymous-owned** rows after approximately **90 days** since last update; rows **owned by an authenticated user** are **not** subject to this TTL.

## User Stories

### Planner — draft and first save

1. As a meal planner, I want to open the weekly planner **without** creating a server record, so that I can experiment without cluttering my saved list.
2. As a meal planner, I want an **inline title** in the planner header, so that my Saved Weekplan has a clear name before I persist it.
3. As a meal planner, I want **Save** to be unavailable or blocked until my title is valid (non-empty trimmed), so that I cannot create nameless saved plans by mistake.
4. As a meal planner, I want **explicit Save** to be the moment the server row is **created**, so that “saved” matches my intent.
5. As a meal planner, I want after the first save to be routed or labeled so I know I am editing a **persisted** plan (e.g. URL includes the saved id), so that I can bookmark or return reliably.

### Planner — autosave after persist

6. As a meal planner, I want changes to the grid and title to **autosave** after my plan exists on the server, so that I do not lose work without extra clicks.
7. As a meal planner, I want visible **save status** (saved / saving / dirty / error), so that I trust the system during autosave.
8. As a meal planner, I want failed autosave to be recoverable (retry / clear error state), so that transient network issues do not strand my edits.

### Planner — leaving unsaved draft

9. As a meal planner, I want a **warning** when navigating away from the app with unsaved draft changes, so that I do not lose work accidentally.
10. As a meal planner, I want **in-app navigation** (links, router) to **confirm** before leaving when my draft has meaningful changes, so that destructive navigation is deliberate.
11. As a meal planner, I want optional **local recovery** of draft state after refresh or crash, so that browser refresh does not wipe a long editing session before first save.

### Manage page — list and discovery

12. As a meal planner, I want a **dedicated page** listing my Saved Weekplans, so that I can see everything I have persisted in one place.
13. As a meal planner, I want the default order to be **most recently updated first**, so that my active plans surface at the top.
14. As a meal planner, I want to **toggle sort** between **recently updated** and **alphabetical by name** without persisting that preference, so that I can quickly switch views for v1.

### Manage page — actions

15. As a meal planner, I want to **open** a Saved Weekplan from the list, so that I land in the planner with that plan loaded.
16. As a meal planner, I want to **rename** a plan **inline** on the list row, so that I can fix titles quickly without entering the planner.
17. As a meal planner, I want to **delete** a Saved Weekplan with a **simple confirmation** dialog, so that removal is intentional but not burdensome.

### Manage page — empty state

18. As a first-time user, I want the manage page to explain **draft vs saved** when I have **no** Saved Weekplans, so that I understand why the list is empty.
19. As a first-time user, I want a clear **Create a week plan** action from the empty state, so that I can start a **draft** in the planner immediately.

### Anonymous and accounts

20. As an anonymous user, I want to **save** week plans to the server, so that I do not need an account to benefit from persistence on this device/session.
21. As a user signing up or logging in, I want to be **prompted** to **move** my anonymous Saved Weekplans into my account or **discard** them, so that I control what becomes permanently mine.
22. As an operator, I want **inactive anonymous** plans **purged** after a long idle period, so that storage does not grow without bound.
23. As an authenticated user, I want my Saved Weekplans **not** deleted by the anonymous purge job, so that account-backed data is treated as durable under normal policies.

### Navigation and IA

24. As a meal planner, I want **one planner** implementation for draft and saved modes, so that behavior stays consistent.
25. As a developer, I want **stable deep links** to a saved plan’s edit session, so that sharing and refresh behave predictably.

### Observability and safety

26. As an operator, I want structured logs for planning mutations **without** PII/secrets in payloads, so that debugging remains safe.
27. As a maintainer, I want domain terminology (**Saved Weekplan**) reflected in user-facing copy even if internal tables retain legacy names temporarily, so that docs and UI stay coherent during staged rollout.

### Regression and coexistence

28. As a maintainer, I want legacy API routes to remain functional until callers migrate, so that rollout is incremental.
29. As a maintainer, I want month-plan features and recipe validation rules to remain consistent where they share planning infrastructure, so that unrelated surfaces do not regress.

## Implementation Decisions

### Domain vocabulary

- **Saved Weekplan**: persisted weekly meal grid (`WeekPlanV1`) plus human-readable **title** (`name`) and metadata (`id`, `created_at`, `updated_at`). Product copy uses **Saved Weekplan**; legacy **week template** naming may persist in code paths until deprecated.

- **Draft week plan**: planner state **not yet** persisted as a Saved Weekplan (no server row). Distinct from an unsaved buffer only in the browser until first save.

### Data model and ownership

- Extend persistence so each row has **ownership**: authenticated **User** (future `user_id`) and/or **anonymous session** identifier suitable for RLS and merge flows. Exact columns (nullable `user_id`, `anon_session_id`, or unified `owner_*`) are an implementation choice; behavior must enforce **only the owning principal** can list/read/update/delete** except administrative tooling.

- **Row retention**: implement a scheduled or periodic job that **deletes** (or archives—out of scope unless specified) **anonymous-owned** Saved Weekplans with **`updated_at` older than ~90 days**. Do **not** apply this TTL to rows owned by an authenticated user.

### Merge at signup / login

- When transitioning from anonymous to authenticated session, present **Move N plans / Discard** (per PRD). **Discard** must be defined as **not retaining** those anonymous rows (typically hard delete or unlink); document for privacy expectations.

### Planner lifecycle

- **Draft**: no autosave to server for the grid/title until first successful **create**.
- **First save**: **POST** creates the Saved Weekplan; client transitions to **saved mode** (URL contains id per routing decision).
- **After create**: **debounced PATCH** autosave for `body` and optional `name` updates (mirror existing autosave timing philosophy).

### Routing

- **Single planner route** for draft and saved: absence of saved identifier ⇒ draft; presence ⇒ load by id (query or path segment—implementation choice). Align with Nuxt pages layout conventions.

### Manage page

- **Default sort**: `updated_at` descending.
- **Toggle**: Updated vs Name; **no** server or local persistence of sort preference for v1.
- **Row actions**: Open, inline Rename, Delete with standard confirm (not type-to-confirm).
- **Empty state**: explanatory copy + primary CTA to start **draft** planner.

### HTTP API surface (staged rollout)

- Add **preferred** routes such as `GET/POST /api/v1/saved-weekplans` and `GET/PATCH/DELETE /api/v1/saved-weekplans/:id` that **wrap** existing repository operations against `meal_week_templates` (or renamed table in a later migration).

- Keep **`/api/v1/planning/week-templates`** behavior available during migration; mark deprecated and remove after consumers switch.

- Request/response bodies remain aligned with **`WeekPlanV1`** validation and existing recipe-id existence checks where applicable.

### Deep modules (build or extend)

- **Planning ownership layer**: resolves current principal (anonymous vs user), enforces scope on repository calls, centralizes merge and purge policies.

- **Saved Weekplan repository adapter**: stable interface for list/get/create/patch/delete that hides whether backing storage is legacy table name or future rename.

- **Draft lifecycle composable or service**: encapsulates dirty detection, `beforeunload`, optional local snapshot serialization—testable without Vue when pure logic is extracted.

- **Autosave controller** (extend existing pattern): clearly separates **no-id draft** (no PATCH) from **post-create autosave** (PATCH).

- **Anon purge job**: isolated module invoked by scheduler/cron with clear metrics/logging event names.

### Technical clarifications

- **Concurrent edits**: default **last-write-wins** unless a future PRD specifies conflict UI.

- **“Inactive” for purge**: driven by **`updated_at`** (autosave updates this); opening without editing does **not** extend life unless a separate `last_opened_at` is added later.

## Testing Decisions

### What makes a good test

- Assert **observable behavior** and contracts: HTTP status and body shapes, authorization denial for wrong owner, validation errors for invalid `WeekPlanV1` or missing recipes, and deterministic outcomes for merge/discard flows where test doubles replace Supabase.

- Avoid coupling tests to internal file layout or composable names when a pure function or repository adapter can be exercised directly.

### Modules to test (recommended scope — confirm with team)

| Area | Suggested focus |
|------|------------------|
| Repository / ownership adapter | List scoped by owner; create/patch/delete forbidden cross-owner; purge candidate selection |
| Validation | `WeekPlanV1` + patch schemas; recipe id existence integration |
| Draft lifecycle helpers | Dirty detection; snapshot restore rules (unit) |
| Autosave controller | Debounce fires PATCH only when id present; no PATCH when draft |
| Planning API handlers | New saved-weekplans routes delegate correctly; deprecated routes unchanged |

### Prior art in codebase

- Unit tests under `test/unit/` for **planning hydration**, **planning autosave**, **week-plan** utilities, **planning errors**, and **recipe** validation patterns—mirror structure and assertion style.

- Integration-style tests where server middleware and logging are validated (`test/integration/logging-v2.test.ts`) as reference for future handler tests if introduced.

**Stakeholder check:** Confirm which modules above should receive automated tests in the first implementation slice versus follow-up issues.

## Out of Scope

- **Duplicate / copy** Saved Weekplan from manage page (explicitly deferred for v1).

- **Archive / trash** with restore (hard delete only for v1 per decisions).

- **Persisted sort preference** or advanced filters (search, tags, folders).

- **Sharing** Saved Weekplans between users or public links.

- **Calendar-bound** instances (“week of Jan 6”) as distinct entities from the reusable saved grid—unless a future PR extends the domain.

- **Renaming database table** `meal_week_templates` in the same slice as UI (may follow after route stabilization).

- **Publishing this PRD** to an external issue tracker (this document is stored locally under `Docs/prd/`).

## Further Notes

- Update **`CONTEXT.md`** with a **Planning** subsection defining **Saved Weekplan**, **Draft week plan**, anonymous merge, and purge policy when implementation begins—domain glossary currently emphasizes logging terms only.

- Consider an **ADR** only if staged API aliases vs table rename involves a hard-to-reverse or surprising trade-off for future readers.

- Align navigation entries so **Saved Weekplans** / **Manage plans** is discoverable from primary IA patterns already enforced by tests (e.g. primary navigation integrity tests) when the route is added.
