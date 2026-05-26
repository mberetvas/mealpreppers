# PRD: Consolidated Shopping List Store Walk Order

Status: Draft
Created: 2026-05-26

## Problem Statement

When using a **Consolidated shopping list** for grocery shopping, ingredients can appear in an order that is hard to follow in-store. Some paths already attempt to sort consolidated lines, but the behavior is inconsistent: baseline fallback lines, AI-skipped baseline lines, and older **Saved consolidated shopping list** records can still appear in a less useful order.

The user needs the **Consolidated shopping list** to behave like a practical store trip list: ingredients should appear in a predictable **Shopping list store walk order** every time consolidated lines are returned or displayed, while **Recipe sections view** should keep its recipe-grouped structure.

## Solution

Apply **Shopping list store walk order** consistently to the **Consolidated shopping list** only. The order is supermarket-area sequence followed by Dutch-locale alphabetical sorting within each area:

produce, bakery, meat, fish, dairy, frozen, dry goods, spices, canned/sauces, oils, beverages, other.

The solution should:

- Keep **Recipe sections view** unchanged.
- Sort consolidated results after **Shopping list consolidation**, including polished, pending-review, fallback, and AI-skipped results.
- Sort loaded **Saved consolidated shopping list** records so older unsorted records become usable without requiring re-consolidation.
- Add a distinct **Shopping list spice area** for dried spices and seasonings.
- Expand canned/sauces keyword matching so sauces and pastes such as tomatenpuree land in the canned/sauces step instead of other.
- Sort editable **Shopping list polish review** lines once on entry, then keep row order fixed while the user edits.
- Continue sorting final confirmed consolidated display whenever lines are served or shown.
- Avoid UI section headers in this change.

## User Stories

1. As a meal planner, I want my **Consolidated shopping list** sorted by store walk order, so that I can shop without scanning a random ingredient order.
2. As a grocery shopper, I want produce items grouped near the top of the consolidated list, so that I can handle fresh items together.
3. As a grocery shopper, I want bakery, meat, fish, dairy, and frozen items to appear in predictable store areas, so that the list matches how I move through the supermarket.
4. As a grocery shopper, I want dry goods to appear before spices and canned/sauces, so that pantry items are grouped in a practical order.
5. As a grocery shopper, I want dried spices such as paprikapoeder and kerriepoeder grouped in a spice area, so that they do not fall to the bottom as other.
6. As a grocery shopper, I want fresh herbs such as peterselie and basilicum to remain produce, so that fresh ingredients are not mixed with dried spices.
7. As a grocery shopper, I want sauces and pastes such as tomatenpuree and pesto grouped with canned/sauces, so that common jarred or tubed items are not left in other.
8. As a grocery shopper, I want unknown ingredients to remain at the end as other, so that unmatched items do not disrupt the known store order.
9. As a Dutch-language user, I want alphabetical ordering within each store area to use Dutch locale behavior, so that ingredient names sort naturally.
10. As a user viewing a consolidated result after successful AI polish, I want the polished lines sorted by store walk order, so that the final list is immediately usable.
11. As a user viewing a consolidated result when **Shopping list AI polish** is skipped, I want the **Shopping list polish baseline** sorted by store walk order, so that missing AI configuration does not make the list harder to use.
12. As a user viewing a consolidated result when **Shopping list polish fallback** occurs, I want fallback baseline lines sorted by store walk order, so that timeout or AI failure still produces a useful list.
13. As a user returning to a valid **Saved consolidated shopping list**, I want the loaded list sorted by store walk order, so that older saved order does not reduce grocery usability.
14. As a user with an older saved list, I want it to be re-sorted on load without requiring re-consolidation, so that the improvement applies to existing data.
15. As a user in **Shopping list polish review**, I want editable lines sorted once when review opens, so that review starts in store order.
16. As a user editing **Shopping list polish review** lines, I want row order to remain fixed while editing, so that fields do not jump as I type.
17. As a user confirming review edits, I want the confirmed consolidated display to use store walk order, so that the final result remains a grocery trip list.
18. As a user editing a saved consolidated list, I want the edit flow to start from sorted lines, so that manual cleanup happens in the same order I will shop.
19. As a user switching to **Recipe sections view**, I want recipe grouping preserved, so that I can still inspect which ingredients came from each recipe.
20. As a user, I do not want visible category headers added in this change, so that the list remains visually simple.
21. As a user, I want ingredient names, quantities, units, and line identity preserved by sorting, so that sorting changes only order, not content.
22. As a user, I want the **Shopping list polish diff** to keep identifying changed lines after sorting, so that AI or review changes remain understandable.
23. As a user, I want repeated refreshes of the same consolidated list to produce stable order, so that the list does not shift unexpectedly.
24. As a maintainer, I want store walk order encapsulated in a small deep module, so that keyword rules and sort behavior can be tested without UI setup.
25. As a maintainer, I want sorting applied at the boundaries where consolidated lines are returned or displayed, so that individual callers do not need to remember every edge case.
26. As a maintainer, I want tests that cover skipped AI, fallback baseline, saved-list load, review entry, spices, and sauces, so that future changes do not regress grocery usability.

## Implementation Decisions

- Use the existing **Shopping list store walk order** module as the deep module for inferring store areas and sorting lines.
- Extend the store area list with a distinct spices step after dry goods and before canned/sauces.
- Add keyword rules for dried spices and seasonings, including common Dutch ingredient names such as paprikapoeder and kerriepoeder.
- Keep fresh herbs matched to produce, not spices.
- Expand canned/sauces keyword rules for jarred and tubed sauces or pastes such as tomatenpuree and related terms.
- Preserve the current sort contract: sorting returns a new ordered list and does not mutate line fields.
- Apply store walk sorting to both consolidated lines and baseline lines produced by **Shopping list consolidation** so fallback and AI-skipped paths are sorted.
- When a **Shopping list polish response** enters pending review, initialise editable review lines from a sorted list.
- Keep review ordering fixed after entry; field edits must not trigger live re-sort.
- Sort lines loaded from **Saved consolidated shopping list** records before assigning them to consolidated display state.
- Sort lines before saving or immediately after save where needed so confirmed display and persisted records stay consistent.
- Do not change **Recipe sections view** ordering or grouping.
- Do not add category headers, labels, or UI grouping in this change.
- Do not change the persistence schema; this is a deterministic ordering improvement over existing line records.
- Do not rely on **Shopping list AI polish** to order lines; the server/client deterministic sorter remains authoritative for final store order.
- Keep sorting based on ingredient names only, without renaming, translating, or pluralising lines.

## Testing Decisions

- Good tests should assert observable behavior: resulting line order, classification of representative names, stability for equal sort keys, and preservation of line content.
- Unit-test the store walk order module for the updated area sequence, spice classification, canned/sauces classification, fresh herb behavior, alphabetical ordering within an area, and stable fallback to other.
- Unit-test consolidation behavior so polished, AI-skipped, and fallback results expose sorted consolidated and baseline lines.
- Unit-test the consolidated shopping-list client state module so saved-list load sorts older records before display.
- Unit-test review entry so pending-review lines start sorted and remain stable after field edits.
- Unit-test confirm/save behavior so final displayed lines remain sorted after review confirmation.
- Reuse the existing unit-test pattern around store walk sorting as prior art.
- Prefer narrow tests around the sorting deep module and the consolidated-list orchestration boundaries instead of browser-level UI assertions for every path.
- Add regression coverage for representative screenshot items: appelazijn, bloemkool, gember, knoflook, paprikapoeder, peterselie, rode appel, rode paprika, tomatenblokjes, and tomatenpuree.

## Out of Scope

- Sorting or re-grouping **Recipe sections view**.
- Adding visible section headers or store area labels to the UI.
- User-configurable store layouts.
- Per-store aisle mapping.
- Drag-and-drop manual ordering.
- Renaming ingredients for store labels.
- Changing quantity consolidation, unit conversion, or AI polish behavior beyond deterministic ordering.
- Changing the saved-list database schema.
- Publishing this PRD to an issue tracker.

## Further Notes

The relevant domain terms are now captured in the glossary: **Shopping list store walk order**, **Shopping list spice area**, **Shopping list sauce area (walk order)**, and **Shopping list polish review order**.

No ADR is needed for this change because the decision is reversible, localized, and primarily a deterministic ordering policy rather than a hard-to-reverse architectural trade-off.
