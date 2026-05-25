---
status: accepted
---

# Shopping list AI consolidation (hybrid server pipeline)

Mealprepper’s shopping list defaults to **recipe sections** (per-recipe ingredient blocks). Households also need a **consolidated shopping list**: one store-oriented list with duplicates merged and Dutch canonical names. We derive that list on demand via a **server-owned consolidation pipeline**—not by persisting a second list on the **Saved Weekplan**.

The pipeline is deliberately hybrid. **Shopping list exact merge** runs first in code (identical normalized name + unit only; reuse ingestion unit aliases). **Shopping list AI polish** then refines the *entire* post–exact-merge list (full polish, not leftover-only): re-group, rename, and merge when units already match. The model receives **shopping list polish context** (baseline lines + recipe provenance), must return **shopping list polish response** JSON (`lines` + optional `changes`), and is constrained by a harness: no invented ingredients, no quantity inflation vs baseline sums per name/unit, **shopping list unit policy (v1)** (no unit conversion), **shopping list polish locale (v1)** (Dutch canonical names). On parse/validation failure we apply **shopping list polish retry policy (v1)** (single model attempt, no repair loop) and **shopping list polish fallback** (show baseline with warning + retry). Results are **ephemeral** per session; each **Consolidate action** re-runs the service.

The UI keeps **recipe sections view** as default. **Shopping list view mode** toggles consolidated view and syncs `view=consolidated` to the URL; switching mode alone does not call the model. **Consolidate action** triggers the API. **Shopping list polish diff** highlights changes vs baseline. **Shopping list partial consolidation** is allowed when some recipes failed to load (same warning as the default view). **Shopping list consolidation access** mirrors **Saved Weekplan** read access for the linked **Planning Principal** (including anonymous session owners).

## LLM stack

**Shopping list AI polish** runs only on the server. We use **LangChain** (TypeScript) with **`@langchain/openrouter`** (`ChatOpenRouter`)—not a generic `ChatOpenAI` base-URL shim. The polish step is a single `ChatPromptTemplate` → `withStructuredOutput(Zod, { method: 'functionCalling' })` → `invoke`, bounded by **shopping list polish retry policy (v1)**. Structured extraction is not left on LangChain’s auto mode (v1). Generation is deterministic: `temperature: 0`, bounded `maxTokens` (default 4096), and request timeout from env (`OPENROUTER_SHOPPING_LIST_TIMEOUT_MS`, default 30000). **OpenRouter** credentials via server env (`OPENROUTER_API_KEY`), never exposed to the browser. **v1 model selection:** one fixed model id (`OPENROUTER_SHOPPING_LIST_MODEL`, default `deepseek/deepseek-v4-flash`); no per-user or in-app model picker in v1. App attribution uses `OPENROUTER_APP_URL` / `OPENROUTER_APP_TITLE` (Mealprepper site name), not LangChain defaults. **Prompt engineering (v1):** system and user templates live in TypeScript (`ChatPromptTemplate` in the shopping-list server slice), not external markdown files—reviewed with schema and harness in the same PR.

**Observability (v1):** always emit structured **Application Logger** events for polish (start/complete/fail, latency, model slug, line counts—no full ingredient payloads). Enable LangChain/LangSmith tracing only when `LANGSMITH_API_KEY` is set (expected in dev/staging, off in production unless explicitly configured).

**Context engineering (v1):** **Shopping list polish context** is passed to the user template as one compact JSON variable (`polishContextJson`)—stable line ids, quantities, units, and recipe provenance—built from typed server data, not a prose bullet list. The system prompt documents the JSON shape; harness validation uses the same typed baseline, not re-parsed model prose. **Line ids (v1):** assigned during **shopping list exact merge** as deterministic merge-order indices (`L1`, `L2`, …); polish `changes` reference these ids, not catalog ingredient ids.

**Missing OpenRouter config (v1):** if `OPENROUTER_API_KEY` is unset, skip the LangChain invoke, log `shopping_list.polish_skipped` (`reason: missing_api_key`), and return **shopping list polish fallback** (baseline + warning, HTTP 200)—same UX as a failed polish call.

**Configuration (v1):** OpenRouter and LangSmith settings are wired through Nuxt **`runtimeConfig`** (server-only keys), not ad hoc `process.env` reads in the chain factory—same pattern as Supabase credentials.

**OpenRouter plugins (v1):** none—no `plugins` (e.g. web search) on `ChatOpenRouter`; polish is closed-world on `polishContextJson` only.

## Considered options

- **Direct provider SDK** (OpenAI/Anthropic client only) — rejected for polish: no shared orchestration layer for structured JSON and future prompt variants.
- **`ChatOpenAI` + OpenRouter base URL** — rejected: `@langchain/openrouter` gives first-class OpenRouter config and attribution headers.
- **LangGraph multi-node polish graph (v1)** — rejected: one structured invoke is enough until retry/repair flows need a graph.
- **`withStructuredOutput` auto / jsonSchema (v1)** — rejected: force `functionCalling` for stable OpenRouter behavior across model env changes.
- **Non-zero temperature / provider defaults (v1)** — rejected: `temperature: 0` and explicit caps for reproducible consolidate runs.
- **External `.md` prompt files (v1)** — rejected: single TS-owned template until few-shot tuning justifies a split.
- **LangSmith always-on** — rejected: optional via `LANGSMITH_API_KEY`; production relies on app logs + UI diff unless tracing is deliberately enabled.
- **Prose-only polish context in the prompt (v1)** — rejected: compact JSON blob for token efficiency and alignment with harness types.
- **Direct `ChatOpenRouter` calls from consolidation service (tests)** — rejected: chain behind **`ShoppingListPolishPort`**.
- **HTTP error when OpenRouter key missing (v1)** — rejected: treat as polish skip + baseline fallback for local dev and misconfig tolerance.
- **`process.env` in chain factory (v1)** — rejected: use **`runtimeConfig`** for OpenRouter/LangSmith values.
- **Catalog ingredient ids as polish line ids (v1)** — rejected: sequential `L{n}` ids owned by exact merge output.
- **`POST /shopping-list/consolidate` with body planId (v1)** — rejected: nest under **Saved Weekplan** path param for ownership and REST semantics.
- **Consolidated-only API body (v1)** — rejected: client needs baseline + `changes` + `polishStatus` in one response for diff and fallback UX.
- **OpenRouter web/plugins on polish (v1)** — rejected: closed-world on provided baseline JSON.
- **Client-posted payloads for merge/AI** — rejected: duplicates plan/recipe resolution rules and drifts from server validation.
- **AI only on unmerged leftovers** — rejected: insufficient for cross-recipe canonical naming; we chose full polish with baseline harness + diff for trust.
- **Persist consolidated output on Saved Weekplan** — deferred: v1 is derived/ephemeral to avoid schema and stale-merge problems.
- **Unit conversion in AI polish (v1)** — rejected: harness complexity; exact merge + same-unit merges only until a conversion table exists.
- **Automatic repair retries on model failure** — rejected for v1: single attempt then baseline fallback.
- **Block consolidate when recipe resolution is partial** — rejected: same “incomplete but useful” stance as the default shopping list.

## Consequences

- **API:** `POST /api/v1/saved-weekplans/:id/consolidate-shopping-list` under **`withPlanningHandler`** (same **Planning Principal** as plan GET). Response bundle (v1): `consolidatedLines`, `baselineLines`, `changes`, `polishStatus` (`polished` | `baseline_fallback` | `ai_skipped`), `warnings[]`—client renders consolidated view and **shopping list polish diff** without recomputing baseline.
- `shopping-list` server module owns load → exact merge → AI → validate.
- Dependencies: `@langchain/openrouter`, `@langchain/core` (prompts), existing `zod`.
- **`ShoppingListPolishPort`** injectable seam: production implements via `createShoppingListPolishChain()`; unit tests stub `polish(context)` with fixture JSON—no OpenRouter in CI.
- LLM provider configuration and cost live on the server; no API keys in the browser.
- Domain terms and relationships live in `CONTEXT.md` under Shopping list; implementation must not contradict the harness policies above.
