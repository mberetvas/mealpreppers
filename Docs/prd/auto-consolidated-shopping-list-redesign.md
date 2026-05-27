# PRD: Auto-consolidated shopping list redesign

**Status:** Draft  
**Source:** [ADR 0004 — Auto-consolidated shopping list redesign](../adr/0004-auto-consolidated-shopping-list-redesign.md)  
**Extends:** [ADR 0002 — Shopping list AI consolidation](../adr/0002-shopping-list-ai-consolidation.md), [ADR 0003 — Shopping list human review and persistence](../../docs/adr/0003-shopping-list-human-review-and-persistence.md)

---

## Problem Statement

Today, getting a store-ready **Consolidated shopping list** often requires the user to discover and press **Consolidate action** on the **Consolidated shopping list page**, even when they already intend to shop from a **Saved Weekplan**. Repeat visits can still feel like starting over when consolidation was never confirmed, when recipes changed without clear guidance, or when a new plan duplicates meals from a week that already had a good list. **Manage plans** and the weekly planner lack a lightweight way to see list readiness or peek at lines without opening the full page. Users who duplicate the same meal grid should not pay for another **Shopping list AI polish** call when a matching **Saved consolidated shopping list** already exists for their **Planning Principal**.

## Solution

Redesign the consolidated shopping list experience so **Shopping list consolidation** runs automatically only when needed on the **Consolidated shopping list page**, always passes through **Shopping list polish review** before anything is persisted, and reuses confirmed lists for unchanged plans or **Consolidated shopping list copy-on-match** for new plans with the same **Shopping list source fingerprint**. **Manage plans** and the planner expose **Weekplan consolidated list status**, **View shopping list** → **Consolidated shopping list preview** (read-only, no AI), and **Open full list** for review, edit, confirm, and in-store use. Consolidated lines are grouped in collapsible **Shopping list aisle section**s following **Shopping list store walk order**.

## User Stories

1. As a meal planner, I want **Shopping list consolidation** to start automatically when I open **Consolidated shopping list** and no valid **Saved consolidated shopping list** exists, so that I do not have to find and press **Consolidate action** first.

2. As a meal planner, I want the page to **auto-switch to consolidated view** when I need consolidation, so that I am not left on **Recipe sections view** while the system prepares a store-ready list.

3. As a meal planner, I want a valid **Saved consolidated shopping list** to load without an AI call when I revisit the same **Saved Weekplan**, so that repeat shopping trips are fast and predictable.

4. As a meal planner, I want nothing written to the server until I **Confirm** after **Shopping list polish review**, so that unreviewed AI output never becomes my saved list.

5. As a meal planner, I want unconfirmed consolidation output held as a **Shopping list consolidation session draft** in the current browser session, so that I can leave the consolidated view and return to the same plan without triggering another AI call.

6. As a meal planner, I want the session draft discarded when I close the tab, so that stale unapproved lists do not survive across sessions.

7. As a meal planner, I want **Shopping list polish review** to open automatically after **Shopping list auto-consolidation trigger** succeeds, so that I can edit lines and approve before save.

8. As a meal planner, I want **Shopping list polish review** to open automatically when **Shopping list polish fallback** runs (missing API key, timeout, parse error), so that I can still edit and **Confirm** an exact-merge baseline instead of being blocked.

9. As a meal planner, I want a clear warning when fallback is used, so that I know AI polish was not applied.

10. As a meal planner, I want **Consolidate action** to remain available for manual re-run or retry, so that I can recover from errors or deliberately regenerate without it being the only path.

11. As a meal planner, I want AI consolidation **not** to run when I only view **Recipe sections view**, so that API cost and surprise review states are avoided.

12. As a meal planner, I want AI consolidation **not** to run on plan save, so that consolidation happens only when I intend to shop.

13. As a meal planner, I want AI consolidation **not** to run from **Consolidated shopping list preview**, so that preview stays lightweight and the full page remains canonical for orchestration.

14. As a meal planner, I want my saved list marked **Deprecated saved consolidated shopping list** when **Shopping list source fingerprint** no longer matches the **Saved Weekplan** body, so that I know recipe edits invalidated the old list.

15. As a meal planner, I want an explicit “recipes changed” notice when opening **Consolidated shopping list** with a deprecated saved list, so that I understand why a new consolidation is starting.

16. As a meal planner, I want **Shopping list auto-consolidation trigger** to run immediately into **Shopping list polish review** after that notice when the saved list is deprecated, so that I am not stuck on a read-only error screen.

17. As a meal planner, I want the previous deprecated lines available read-only for comparison (e.g. collapsed **Previous list**), so that I can see what changed before confirming a new list.

18. As a meal planner, I want to **Edit list** on a valid **Saved consolidated shopping list** without a new AI call, so that small corrections do not require re-consolidation.

19. As a meal planner creating a **new** **Saved Weekplan** with the same meals as an existing plan, I want **Consolidated shopping list copy-on-match** to copy the other plan’s **Saved consolidated shopping list** server-side on `POST` create, so that I skip AI and review when the meal grid already matches.

20. As a meal planner, I want copy-on-match to use the source plan with the latest `confirmedAt` when multiple plans match, so that I inherit the most recently confirmed list.

21. As a meal planner, I want copied lists saved immediately as **Saved consolidated shopping list** without a second **Confirm** gate, so that copy-on-match is frictionless when fingerprints match.

22. As a meal planner, I want a one-time dismissible **Consolidated shopping list copy notice** the first time I open preview or the full page after copy-on-match, so that I know the list was inherited and can review if needed.

23. As a meal planner, I want copy-on-match **not** to run on `PATCH` edits to an existing plan, so that silent inheritance does not surprise me after I change recipes.

24. As a meal planner, I want copy-on-match scoped to my **Planning Principal**, so that another user’s lists are never copied to my plan.

25. As a meal planner, I want a new plan with no matching source to follow normal **Shopping list auto-consolidation trigger** on first consolidated visit, so that unmatched plans still get a list.

26. As a meal planner on **Manage plans**, I want **Weekplan consolidated list status** showing **List ready**, **List outdated**, or **No list yet**, so that I can see list health at a glance.

27. As a meal planner in the weekly planner, I want the same **Weekplan consolidated list status** when a **Saved Weekplan** is open, so that status is consistent across entry points.

28. As a meal planner, I want **View shopping list** from manage and planner even when **No list yet**, so that the primary entry point is never hidden.

29. As a meal planner, I want **View shopping list** to open **Consolidated shopping list preview** with read-only aisle-grouped lines when a valid saved list exists, so that I can quickly check what to buy without leaving my planning context.

30. As a meal planner, I want preview sections to be **Shopping list aisle section**s that are collapsible and start expanded, so that I can fold areas I have already shopped.

31. As a meal planner, I want collapse state in preview **not** persisted across opens, so that each visit starts fully expanded for scanning.

32. As a meal planner, I want preview to show a short empty-state and **Open full list** when **No list yet**, so that I know consolidation will happen on the full page.

33. As a meal planner, I want preview to show an outdated warning and **Open full list** when **List outdated**, without running AI in the modal, so that I am directed to the canonical flow.

34. As a meal planner, I want **Open full list** to navigate to **Consolidated shopping list page** with the correct plan link, so that review, edit, confirm, and in-store use happen in one place.

35. As a meal planner, I want consolidated lines sorted by **Shopping list store walk order** whenever the server returns them, so that preview and saved views match in-store sequence.

36. As a meal planner shopping in-store on the full page, I want consolidated lines grouped under Dutch shopper aisle labels, so that the list matches how I walk the supermarket.

37. As a meal planner, I want all aisle sections expanded on each open of the full consolidated view, so that I do not miss items in collapsed sections from a prior visit.

38. As a meal planner, I want **Shopping list polish hint**s during review when harness rules flag issues, so that I can fix problems before **Confirm** without the server silently falling back.

39. As a meal planner with an empty **Saved Weekplan** (no recipe slots), I want consolidation to explain that no list can be built, so that I am not stuck in a loading loop.

40. As a meal planner when catalog recipes fail to load, I want consolidation to surface the same resolution-failure semantics as the recipe-sections view, so that behavior is consistent.

41. As a developer maintaining the app, I want list and detail APIs for **Saved Weekplans** to expose `hasSavedShoppingList` and `shoppingListDeprecated`, so that badges and preview can hydrate without loading full consolidated records for every row.

42. As a meal planner, I want **Recipe sections view** to remain available via **Shopping list view mode** toggle, so that I can still inspect per-recipe ingredients when needed.

43. As a meal planner with a valid saved list, I want the consolidated tab to be the sensible default when the URL omits view mode, so that I land on the list I already confirmed.

44. As a meal planner mid-review, I want switching away from consolidated view and back to resume the **Shopping list consolidation session draft**, so that navigation within the session does not lose work.

45. As a meal planner, I want harness validation failures to show hints in review rather than replacing AI output with fallback, so that model mistakes are visible and fixable by a human.

## Implementation Decisions

### Architectural stance

- **Consolidated shopping list page** is the sole orchestrator for **Shopping list auto-consolidation trigger**, **Shopping list polish review**, **Confirm** (`PUT` **Consolidated shopping list API**), **Edit saved consolidated shopping list**, and optional **Consolidate action**.
- **Consolidated shopping list preview** is read-only display plus navigation; it never calls consolidate.
- Confirmed persistence remains on the **Saved Weekplan** row as **Saved consolidated shopping list record** (lines, **Shopping list source fingerprint**, `confirmedAt`); no separate shopping-list table.

### Deep modules (build or extend)

| Module | Responsibility | Interface (stable surface) |
|--------|----------------|---------------------------|
| **Shopping list consolidation service** | Load plan, resolve catalog, build **Shopping list consolidation context**, run **Shopping list AI polish**, harness hints, **Shopping list exact merge** fallback with `pending_review` | `consolidateShoppingList(planId, deps) → ConsolidationResult` |
| **Consolidated shopping list repository** | Persist/load list; compute flags; **copy-on-match** lookup by fingerprint for principal | `getConsolidatedShoppingList`, `putConsolidatedShoppingList`, `getShoppingListFlags`, `copyConsolidatedListFromMatchingPlan` (new) |
| **Shopping list source fingerprint** | Canonical digest of plan `body`; mismatch → deprecated | `computeSourceFingerprint(body)`, compare on load/save |
| **Shopping list store walk order / aisle sort** | Server-side line ordering and aisle category inference | `sortShoppingListLines`, `groupLinesByAisle` (or equivalent) |
| **useConsolidatedShoppingList** | Hydrate saved list; session draft; auto-trigger policy; review/save/edit state machine | Composable API consumed by page and tests |
| **Consolidated shopping list page adapter** | View mode URL sync; watches hydration + deprecation; invokes composable auto-trigger and tab switch | Thin Vue page |
| **Saved Weekplan create handler** | After insert, run copy-on-match; set copy-notice flag on plan metadata or response field for client | `POST /api/v1/saved-weekplans` side effect |
| **Saved Weekplan read/list adapters** | Embed `hasSavedShoppingList`, `shoppingListDeprecated` on detail; extend list rows as needed | GET single + GET collection |
| **Shopping list aisle section (UI)** | Collapsible Dutch-labeled groups; shared by preview, review, saved consolidated display | Presentational component + props for lines/readonly |
| **Consolidated shopping list preview (UI)** | Modal/sheet; status-driven empty/outdated/ready; **Open full list** link | Emits open-full, reads flags + optional GET list |
| **Weekplan consolidated list status (UI)** | Badge mapping: ready / outdated / none | Props: `hasSavedShoppingList`, `shoppingListDeprecated` |
| **Consolidated shopping list copy notice (UI)** | One-time dismissible banner; local dismiss key per plan | Client-only dismiss state keyed by plan id |

### Auto-consolidation trigger (client policy)

- Fire when: `view=consolidated` (or after auto-switch), hydration settled, no valid saved list **or** deprecated saved list, no in-memory session draft for that plan, not already consolidating.
- Do not fire when: valid **Saved consolidated shopping list** loaded; user only on recipe sections; preview open; plan not loaded.
- On deprecated: show “recipes changed” copy, keep deprecated lines in UI for comparison, then call consolidate (same as greenfield missing list).
- On success or fallback with `pending_review`: enter review; do not persist.
- Session draft: store `reviewLines`, hints, baseline, warnings, polish status in composable module-level or `useState` scoped by plan id; clear on confirm, plan change, or explicit reset.

### Auto-switch to consolidated view

- When URL has no `view` query: after hydration, if no valid saved list **or** deprecated → set `view=consolidated` and trigger consolidation; if valid saved list → default consolidated (per **Consolidated shopping list default view**).
- When valid saved list exists and user explicitly chose recipe sections, respect toggle.

### Copy-on-match (server)

- Trigger: only `POST` create **Saved Weekplan**, after row insert and fingerprint computed.
- Match: same **Planning Principal**, same **Shopping list source fingerprint**, source has non-null consolidated list, source not deprecated relative to its body.
- Tie-break: highest `confirmedAt` on source record.
- Write: copy lines + fingerprint to new plan; new `confirmedAt`; expose `copiedFromShoppingList: true` (or equivalent) once on first GET so client can show **Consolidated shopping list copy notice**.
- No `pending_review` for copy path.

### API contracts

- Existing: `POST .../consolidate-shopping-list`, `GET`/`PUT .../consolidated-shopping-list`, plan `GET` flags.
- Extend: `GET /api/v1/saved-weekplans` collection items include `hasSavedShoppingList`, `shoppingListDeprecated` (if not already present).
- Optional response field on create or plan GET after copy: `shoppingListCopiedFromMatch: boolean` (cleared after first consumer read or client dismiss — pick one consistent approach in implementation).

### Aisle presentation

- Server continues to return flat lines in **Shopping list store walk order**.
- Client groups by aisle category for display in preview, review (optional grouping), and saved consolidated view.
- Collapse state: ephemeral per mount; all expanded initially.

### Rejected patterns (do not implement)

- Background consolidate on plan save; AI from preview; copy-on-match on PATCH; manual “pick list from…”; re-confirm after fingerprint-matched copy; error-only screen without review on auto-trigger; disabling **View shopping list** when no list.

## Testing Decisions

### What makes a good test

- Assert **observable behavior** and contracts: HTTP status and body shapes, flag combinations, UI test ids and visible copy, navigation targets — not private function call order or internal draft storage mechanics unless exposed via behavior.
- Prefer **deep module** unit tests with stubbed ports (consolidation service, repository, fingerprint) over full-stack unless covering a thin adapter.

### Modules to test (recommended)

| Module | Test focus | Prior art |
|--------|------------|-----------|
| **Shopping list consolidation service** | Empty plan, total recipe failure, AI success → `pending_review`, fallback → reviewable lines + warning, harness hints not blocking | `test/unit/consolidation-service.test.ts` |
| **Consolidated shopping list repository** | Flags, deprecation on fingerprint mismatch, sort-on-load, PUT persistence | `test/unit/saved-consolidated-shopping-list-persistence.test.ts`, `deprecated-saved-consolidated-shopping-list.test.ts` |
| **Copy-on-match** | POST only; principal isolation; latest `confirmedAt` wins; no copy when fingerprint differs; copied record readable via GET | New unit tests on repository + create handler |
| **Shopping list source fingerprint** | Stable canonical JSON; slot normalization | Existing fingerprint tests if present |
| **Aisle sort / grouping** | Walk order, Dutch labels, empty sections omitted | `test/unit/shopping-list-aisle-sort.test.ts` |
| **useConsolidatedShoppingList** | Hydration; draft resume without second POST; auto-trigger guards; confirm blocked when deprecated | `test/unit/edit-saved-consolidated-shopping-list.test.ts`, deprecated tests |
| **Consolidated shopping list page** | Auto-switch query; auto-consolidate on consolidated tab; deprecated banner + auto-run; fallback opens review | `test/component/shopping-list-*.test.ts` |
| **Preview modal** | No consolidate call; ready shows aisles; no-list/outdated empty states + **Open full list** link | New component tests |
| **Status badges** | Three states from flags on manage/planner list rows | New component or contract tests on list API embed |

### Out of scope for automated tests (unless requested)

- Live OpenRouter integration; visual design of modal chrome; collapse animation.

## Out of Scope

- Manual “choose which week’s list to copy” UI (**Consolidated shopping list copy-on-match** is automatic only).
- Copy-on-match when editing an existing plan (`PATCH`).
- Running **Shopping list consolidation** from **Consolidated shopping list preview** or on plan save.
- Persisting **Shopping list consolidation session draft** server-side or across devices.
- Persisting aisle collapse state across sessions.
- In-preview edit, check-off, or **Confirm**.
- Requiring a second **Confirm** after fingerprint-matched copy.
- Background regeneration on every recipe edit while user is on recipe sections view.
- Check-off / purchased-state tracking for store use (unless already shipped separately).
- Changes to **Shopping list unit policy** or **Shopping list name policy** beyond existing ADR 0002 behavior.
- New shopping-list table or principal model changes.

## Further Notes

- This PRD implements [ADR 0004](../adr/0004-auto-consolidated-shopping-list-redesign.md); vocabulary aligns with **Shopping list** terms in `CONTEXT.md`.
- Partial implementation may already exist (consolidation service, persistence, flags on plan GET, composable skeleton). Gap work is concentrated in **auto-trigger + session draft**, **copy-on-match on POST**, **list endpoint flags**, **aisle section UI**, **preview modal + status badges**, and **deprecated auto-regenerate into review** (replacing manual-only consolidate CTA where ADR requires automatic flow).
- **Consolidate action** stays as secondary control for retry and explicit regeneration after the user has a polished saved list.
- Align empty/loading copy with **Shopping list auto-consolidation trigger** (“Consolidating…”, “Recipes changed — building a new list…”).
- When implementing copy notice dismiss, use a per-plan client key (e.g. localStorage) so “one-time” survives navigation but not conflate with server persistence.
