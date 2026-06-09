## 2025-05-23 - [Optimizing List Sorting and Filtering]

**Learning:** Sorting large lists by ISO 8601 date strings in the frontend using `new Date().getTime()` is inefficient because it triggers thousands of temporary `Date` object allocations and expensive string parsing on every filter update (e.g., every keystroke in search). Since ISO 8601 strings are lexicographically sortable, direct string comparison is a much faster and lower-allocation alternative.

**Action:** Replace `new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()` with string comparison in `utils/recipeFiltering.ts` and `utils/savedWeekplansListSort.ts`. Consolidate duplicated filtering logic in `app/pages/recipes/index.vue` to use the optimized shared utility.
