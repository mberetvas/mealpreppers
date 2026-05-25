# PRD: Shopping list AI consolidation

**Status:** Draft  
**Source:** [ADR 0002 — Shopping list AI consolidation](../adr/0002-shopping-list-ai-consolidation.md)  
**Domain vocabulary:** `CONTEXT.md` (Shopping list)

---

## Problem Statement

Mealprepper already builds a **Shopping list** from a **Saved Weekplan**, grouped into **recipe sections** (one block per recipe, quantities scaled by slot occurrences). That layout helps while cooking (“what do I need for Tuesday’s pasta?”) but is awkward in the store: the same ingredient appears in multiple sections under different wording, units, or spellings, and there is no single list to work through aisle by aisle.

Households need a **Consolidated shopping list**: one store-oriented list with duplicates merged and Dutch canonical ingredient names they recognize from local supermarkets. That list must be trustworthy (no invented items, no silent quantity inflation) and must not require signing in beyond what the plan already allows. Developers need a clear server-owned pipeline so merge rules, AI constraints, and access control stay consistent with **Planning Principal** semantics—not duplicated in the browser.

## Solution

Keep **Recipe sections view** as the default **Shopping list** experience. Add **Shopping list view mode** so users can switch to a **Consolidated shopping list** (URL reflects `view=consolidated`; switching mode alone does not call the model).

When the user triggers the **Consolidate action**, the client calls a **Shopping list consolidation** API on the **Saved Weekplan**. The **Shopping list consolidation service** loads the plan, resolves **Public Recipe Catalog** recipes, runs **Shopping list exact merge** in code, then **Shopping list AI polish** via a server-only LangChain + OpenRouter chain. A harness validates model output against the **Shopping list polish baseline**; on failure or missing API key, **Shopping list polish fallback** shows the baseline with a warning and retry. The response includes baseline, consolidated lines, optional changes, and status so the UI can render **Shopping list polish diff** without recomputing baseline. Results are **ephemeral** (session-only); each consolidate re-runs the pipeline.

---

## User Stories

### Discovery and navigation

1. As a planner, I want the shopping list page to default to **Recipe sections view**, so that I still see ingredients grouped by recipe while meal prepping.
2. As a shopper, I want to switch to **Consolidated shopping list** view without losing my selected **Saved Weekplan**, so that I can choose the layout that fits the moment.
3. As a user sharing a link, I want `view=consolidated` in the URL to restore consolidated view on refresh, so that bookmarks and shared URLs preserve my chosen **Shopping list view mode**.
4. As a user opening consolidated view for the first time, I want to see guidance that consolidation runs only after **Consolidate action**, so that I do not expect an automatic AI call on toggle alone.

### Consolidate action and loading

5. As a shopper, I want an explicit **Consolidate action** in consolidated view, so that I control when AI runs and when API cost is incurred.
6. As a shopper, I want clear loading feedback while consolidation runs, so that I know the list is being built and not frozen.
7. As a shopper, I want to retry consolidation after a failure, so that transient provider errors do not block my trip to the store.
8. As a shopper, I want consolidated results to stay available while I stay on the page in consolidated mode, so that I do not lose the list when scrolling or interacting with warnings.
9. As a shopper, I want each new **Consolidate action** to refresh the consolidated list from current plan data, so that edits in the planner are reflected after I consolidate again.

### Trust, diff, and polish quality

10. As a skeptical shopper, I want **Shopping list polish diff** highlighting lines that changed versus the **Shopping list polish baseline**, so that I can see what the AI adjusted before I shop.
11. As a shopper, I want consolidated ingredient names in Dutch store-style labels, so that the list matches how I read packages in Belgian/Dutch stores.
12. As a shopper, I want the consolidated list never to include ingredients that were not in my week’s loaded recipes, so that I do not buy spurious items.
13. As a shopper, I want total quantities per name and unit never to exceed what exact merge already summed, so that the AI cannot silently increase how much I must buy.
14. As a shopper, I want lines with incompatible units to remain separate, so that I am not misled by automatic unit conversion I did not ask for.
15. As a shopper, I want exact merge to combine only identical normalized names and units (including aliases like `gr` → `g`), so that programmatic merging is predictable before AI runs.
16. As a shopper, I want AI polish to be able to rename and re-group the full post–exact-merge list (not only “leftover” unmerged rows), so that cross-recipe synonyms like “tomaten” vs “cherrytomaten” can be unified when appropriate.
17. As a shopper, I want optional `changes` from the model to explain edits in human-readable form, so that I understand why a line moved or merged when diff alone is ambiguous.

### Partial plans and errors

18. As a user with **Shopping list recipe resolution failure**, I want **Shopping list partial consolidation** using only loaded **Recipe section**s, so that a useful store list is still possible when some catalog fetches fail.
19. As a user with partial failure, I want the same incomplete warning visible in consolidated view as in recipe sections view, so that I do not assume missing recipes are included.
20. As a user with **Shopping list total recipe resolution failure**, I want consolidate to be unavailable or clearly meaningless (no sections), consistent with the empty recipe-section state, so that I am not shown a fake consolidated list.
21. As a user with **Shopping list empty plan**, I want consolidate not to produce a misleading list, so that I am directed to add recipes first.
22. As a user who cannot load the **Saved Weekplan**, I want consolidate to fail with the same access semantics as plan GET, so that authorization is consistent.

### Access and principals

23. As an anonymous session owner, I want to consolidate shopping lists for my own anonymous **Saved Weekplan**s, so that I do not need an account to use consolidation.
24. As an authenticated user, I want consolidation scoped to plans I can read under **Planning Principal** rules, so that other users’ plans are not consolidatable via ID guessing.
25. As a developer operating locally without OpenRouter, I want the app to skip AI gracefully and show baseline with a warning (HTTP 200), so that local dev is not blocked by missing keys.

### Recipe sections parity

26. As a meal prepper, I want to return to **Recipe sections view** from consolidated view at any time, so that I can cross-check per-recipe quantities.
27. As a meal prepper, I want refresh on the shopping list page to reload plan and recipes in recipe sections view, so that my source data stays current before I consolidate again.
28. As a meal prepper, I want occurrence badges in recipe sections unchanged by consolidation work, so that planning context in section headers remains accurate.

### Operations and observability

29. As an operator, I want structured **Application Logger** events for polish start, complete, fail, latency, model slug, and line counts (without full ingredient payloads), so that I can monitor health and cost in production.
30. As a developer, I want optional LangSmith tracing when configured, so that I can debug prompts in dev/staging without forcing tracing in production.
31. As a deployer, I want OpenRouter and polish settings on server **runtimeConfig**, so that secrets and timeouts are not read ad hoc in chain code.

### Configuration and cost control

32. As a product owner, I want a fixed v1 model via environment default, so that behavior and cost are stable across deploys.
33. As a product owner, I want deterministic generation (`temperature: 0`, bounded tokens, request timeout), so that repeated consolidate runs on the same plan are comparable.
34. As a security owner, I want OpenRouter credentials only on the server, so that API keys never reach the browser.

### Future-safe boundaries (v1 explicit non-goals surfaced as stories)

35. As a shopper, I accept that consolidated output is not saved on the **Saved Weekplan**, so that I understand I must consolidate again after a full page reload unless the client still holds session state.
36. As a shopper, I accept there is no in-app model picker in v1, so that support and cost stay manageable.

---

## Implementation Decisions

### Deep modules (proposed)

| Module | Responsibility | Stable interface (conceptual) |
|--------|----------------|----------------------------------|
| **Shopping list consolidation service** | Orchestrate load plan → resolve recipes → exact merge → polish → harness → response bundle | `consolidateShoppingList(planId, principal)` → polish result DTO |
| **Shopping list exact merge** | Deterministic merge; assign line ids `L1`, `L2`, …; normalize names/units; reuse ingestion unit aliases | Input: scaled section ingredients + provenance → baseline lines + context |
| **Shopping list polish harness** | Validate **Shopping list polish response** against baseline (no invented lines, quantity caps per name/unit, unit policy, locale) | `validatePolish(baseline, response)` → pass or structured failure |
| **Shopping list polish port** | Injectable seam for AI polish (production chain vs test stub) | `polish(polishContext)` → response or throw |
| **Shopping list polish chain factory** | LangChain `ChatPromptTemplate` → `withStructuredOutput` (function calling) → `invoke`; OpenRouter via `@langchain/openrouter` | Built from **runtimeConfig**; skipped when API key missing |
| **Consolidate API adapter** | Thin Nuxt handler under **Planning Request Context** | `POST` saved weekplan consolidate route |

These modules mirror ADR 0002: exact merge and harness are test-heavy without network; polish port stubs fixtures in CI.

### API

- Route: `POST /api/v1/saved-weekplans/:id/consolidate-shopping-list` (nested under plan id for ownership and REST semantics—not a standalone body-posted `planId`).
- Wrapper: same **Planning Principal** / handler pattern as existing saved weekplan GET.
- Response bundle (v1): `consolidatedLines`, `baselineLines`, `changes`, `polishStatus` (`polished` | `baseline_fallback` | `ai_skipped`), `warnings[]`.
- Missing `OPENROUTER_API_KEY`: skip invoke, log `shopping_list.polish_skipped` (`reason: missing_api_key`), return baseline + warning, HTTP 200 (**Shopping list polish fallback** UX).

### Server pipeline order

1. Load **Saved Weekplan**; enforce **Shopping list consolidation access**.
2. Resolve catalog recipes (same partial/total failure semantics as client list build).
3. Build scaled ingredients per **Recipe section** traversal order (day ascending, breakfast → lunch → dinner).
4. **Shopping list exact merge** → **Shopping list polish baseline** + **Shopping list polish context** (compact JSON: stable line ids, quantities, units, recipe provenance).
5. **Shopping list AI polish** (single attempt per **Shopping list polish retry policy (v1)**).
6. Harness validation; on failure → **Shopping list polish fallback** (no repair loop).
7. Emit structured logs; optional LangSmith if `LANGSMITH_API_KEY` set.

### LLM integration (v1)

- Stack: LangChain TypeScript, `ChatOpenRouter`, structured output with Zod + `method: 'functionCalling'` (not auto/jsonSchema).
- Prompts: system + user templates in TypeScript (`ChatPromptTemplate`), user template receives `polishContextJson` (not prose bullet lists).
- Model: `OPENROUTER_SHOPPING_LIST_MODEL` (default `deepseek/deepseek-v4-flash`); `temperature: 0`; `maxTokens` default 4096; timeout `OPENROUTER_SHOPPING_LIST_TIMEOUT_MS` (default 30000).
- Attribution: `OPENROUTER_APP_URL`, `OPENROUTER_APP_TITLE`.
- No OpenRouter plugins (closed-world on provided baseline JSON).

### Client

- Extend shopping list page/composable: view mode toggle + URL sync; consolidated UI; **Consolidate action** calls API; render diff from `changes` + baseline vs consolidated comparison.
- Do not POST client-computed ingredient payloads for merge/AI (server owns resolution rules).
- Reuse existing section build utilities where possible for parity; consolidation remains server-authoritative.

### Dependencies

- Add `@langchain/openrouter`, `@langchain/core` (prompts); use existing `zod`.
- Wire env through Nuxt **runtimeConfig** (server-only keys), aligned with Supabase credential pattern.

### Persistence

- **Consolidated shopping list persistence (v1):** none on **Saved Weekplan**; ephemeral per session / per consolidate response.

---

## Testing Decisions

### What makes a good test

- Assert **observable behavior** at module boundaries: merged quantities, line id stability, harness rejections, API status/body shape, fallback when polish fails or key missing.
- Avoid asserting LangChain internals or prompt string literals; stub **Shopping list polish port** with fixture JSON.
- Do not call OpenRouter in CI.

### Modules to test (recommended)

| Module | Priority | Rationale |
|--------|----------|-----------|
| **Shopping list exact merge** | High | Pure deterministic core; many edge cases (aliases, separate units, provenance, `L{n}` ids) |
| **Shopping list polish harness** | High | Safety contract (no invented ingredients, quantity caps, unit policy) |
| **Shopping list consolidation service** | High | Orchestration + fallback paths with stubbed port |
| Consolidate API handler | Medium | Auth/plan not found wiring via existing planning handler tests pattern |
| **Shopping list polish chain factory** | Low in CI | Smoke or manual with key; production path covered by port stub at service layer |
| Client composable / page states | Medium | View mode URL, consolidate loading/error/fallback UI (component tests similar to existing shopping list page state tests) |

### Prior art

- `test/unit/shopping-list.test.ts` — `collectRecipeOccurrences`, `buildShoppingList`, formatting (extend or mirror for server-side list building inputs).
- `test/unit/use-shopping-list.test.ts` — composable race guard and fetch orchestration.
- `test/component/shopping-list-page-states.test.ts` — empty plan, total failure, partial warning patterns to extend for consolidated mode and fallback banner.

### Verification checklist (acceptance)

- Exact merge combines `400 g` + `400 g` same name; keeps `400 g` and `2 stuks` separate.
- `gr` and `g` merge via shared alias table consistent with recipe ingestion.
- Harness rejects invented line ids and quantity inflation vs baseline sums.
- API returns `baseline_fallback` on validation failure with `baselineLines` usable in UI.
- API returns `ai_skipped` when API key unset, HTTP 200, warning present.
- Anonymous principal can consolidate own plan; cannot consolidate another user’s plan.
- Partial recipe failure still returns consolidation from loaded sections + warning.
- View toggle updates URL; toggle alone does not invoke consolidate endpoint.

---

## Out of Scope

- Persisting **Consolidated shopping list** on **Saved Weekplan** or database cache rows.
- **Shopping list** unit conversion in AI or exact merge (e.g. ml ↔ g) until a conversion table exists.
- Automatic model repair loops or multi-attempt **Shopping list polish retry policy** beyond v1 single attempt.
- LangGraph multi-node polish graphs.
- Per-user or in-app OpenRouter model picker.
- OpenRouter web search / plugins on polish calls.
- Client-side merge or browser-exposed LLM calls.
- AI polish limited to “unmerged leftovers” only (rejected in ADR).
- Blocking **Consolidate action** when **Shopping list recipe resolution failure** is partial (same “incomplete but useful” stance as default list).
- External markdown prompt files for v1 (templates stay in TypeScript).
- Non-Dutch **Shopping list polish locale** auto-detection in v1.

---

## Further Notes

- **Relationship to existing shopping list work:** Recipe-section list generation (composable + `utils/shoppingList`) is implemented; this PRD covers the consolidation vertical slice on top of the same plan/recipe inputs.
- **ADR alignment:** Implementation must not contradict harness policies in ADR 0002 and terms in `CONTEXT.md` Shopping list section.
- **Local PRD:** This document is stored under `Docs/prd/` for implementation planning; triage/issue creation is a separate step if the team uses the issue tracker workflow.

### Module expectations (for implementer confirmation)

Before coding, confirm whether the proposed deep modules match team expectations and which modules must have unit tests in the first PR (recommended: exact merge, harness, consolidation service with stubbed port).
