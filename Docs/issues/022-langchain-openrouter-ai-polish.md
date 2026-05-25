# LangChain/OpenRouter AI polish integration

**Label:** `needs-triage`

## Parent

[PRD — Shopping list AI consolidation](../prd/shopping-list-ai-consolidation.md)

## What to build

Production implementation of **Shopping list polish port** using LangChain TypeScript and `@langchain/openrouter`, plus full pipeline wiring so **Shopping list consolidation service** returns `polished` or `baseline_fallback` status.

**Chain factory** (`createShoppingListPolishChain`):
- `ChatOpenRouter` with `temperature: 0`, bounded `maxTokens` (default 4096), request timeout from `OPENROUTER_SHOPPING_LIST_TIMEOUT_MS` (default 30 000).
- `ChatPromptTemplate` (system + user templates in TypeScript) → `withStructuredOutput(Zod, { method: 'functionCalling' })` → `invoke`.
- Model: `OPENROUTER_SHOPPING_LIST_MODEL` (default `deepseek/deepseek-v4-flash`).
- Attribution: `OPENROUTER_APP_URL`, `OPENROUTER_APP_TITLE`.
- No OpenRouter plugins (closed-world on `polishContextJson`).

**Prompt engineering (v1):** system prompt documents the JSON shape of `polishContextJson`; user template receives it as a single compact JSON variable. Templates live in TypeScript alongside the chain factory — no external markdown files.

**runtimeConfig:** wire remaining OpenRouter env vars (`OPENROUTER_SHOPPING_LIST_MODEL`, `OPENROUTER_SHOPPING_LIST_TIMEOUT_MS`, `OPENROUTER_APP_URL`, `OPENROUTER_APP_TITLE`) and optional LangSmith (`LANGSMITH_API_KEY`) as server-only keys.

**Consolidation service integration:** exact merge → polish port invoke → **harness validate** → on pass return `polishStatus: 'polished'`; on harness failure return `polishStatus: 'baseline_fallback'` + warning (no repair loop per **Shopping list polish retry policy v1**).

**Observability:** structured log events for polish start, complete, and fail (latency, model slug, line counts — no full payloads). LangSmith tracing enabled only when `LANGSMITH_API_KEY` is set.

**Dependencies:** add `@langchain/openrouter`, `@langchain/core`.

## Acceptance criteria

- [ ] `ShoppingListPolishPort` production implementation calls `ChatOpenRouter` via chain factory
- [ ] Chain uses `temperature: 0`, `maxTokens`, timeout, model from `runtimeConfig`
- [ ] Structured output via Zod + `method: 'functionCalling'` (not auto/jsonSchema)
- [ ] Attribution headers set from `runtimeConfig` (not LangChain defaults)
- [ ] Consolidation service returns `polishStatus: 'polished'` when harness passes
- [ ] Consolidation service returns `polishStatus: 'baseline_fallback'` + warning when harness rejects AI output
- [ ] No repair loop on harness failure (single attempt per retry policy v1)
- [ ] LangSmith tracing active only when `LANGSMITH_API_KEY` is set; off otherwise
- [ ] Structured log events for polish start/complete/fail with latency and model slug
- [ ] No OpenRouter plugins configured on the chain
- [ ] Tests: consolidation service with stubbed port (polished path + harness-failure → fallback path), chain factory config validation (missing key → skip, required fields present)

## Blocked by

- [019 — Shopping list exact merge](./019-shopping-list-exact-merge.md)
- [020 — Shopping list polish harness](./020-shopping-list-polish-harness.md)
- [021 — Consolidation API with baseline fallback](./021-consolidation-api-baseline-fallback.md)
