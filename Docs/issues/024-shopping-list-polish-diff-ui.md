# Shopping list polish diff UI

**Label:** `needs-triage`

## Parent

[PRD — Shopping list AI consolidation](../prd/shopping-list-ai-consolidation.md)

## What to build

**Shopping list polish diff** rendering in the consolidated view: visual indication of lines that differ between the **Shopping list polish baseline** and the **Consolidated shopping list** after AI polish, plus display of optional `changes` explanations from the model.

**Diff highlighting:**
- Compare `consolidatedLines` to `baselineLines` from the API response.
- Mark lines that were renamed, merged, or re-grouped by AI polish.
- Lines unchanged from baseline have no special marking.

**Changes display:**
- Render optional `changes` array from the model response as human-readable explanations (e.g. "merged 'tomaten' and 'cherrytomaten'").
- When `changes` is empty or absent, diff relies on line comparison alone.
- When `polishStatus` is `baseline_fallback` or `ai_skipped`, no diff is shown (baseline equals consolidated).

## Acceptance criteria

- [ ] Lines changed by AI polish are visually distinguished from unchanged lines
- [ ] Optional `changes` explanations are rendered when present
- [ ] No diff indicators when `polishStatus` is `baseline_fallback` or `ai_skipped`
- [ ] No diff indicators when consolidated lines exactly match baseline
- [ ] Tests: component tests for diff rendering with changes, without changes, and no-diff states

## Blocked by

- [022 — LangChain/OpenRouter AI polish](./022-langchain-openrouter-ai-polish.md)
- [023 — Client view mode toggle + consolidated view](./023-client-view-mode-consolidated-view.md)
