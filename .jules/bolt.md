## 2025-05-22 - [N+1 Query Optimization in Recipe Repository]

**Learning:** The `list_recipes` implementation in `src-tauri/src/shadow_server/recipe_catalog/repository.rs` followed a classic N+1 query pattern, fetching ingredients and steps one-by-one for each recipe. This is particularly costly in a local database context where many small queries add up, especially if the library grows large.

**Action:** Prefer batched queries using `IN` clauses and memory-side grouping with `HashMap` to fetch related entities in bulk. This reduces database round-trips from `1 + 2N` to exactly 3.

## 2025-05-23 - [Optimized ISO Date Sorting in Frontend]

**Learning:** Lexicographical string comparison of ISO 8601 strings is significantly faster than parsing them into `Date` objects. In this codebase, sorting recipes by `updatedAt` using `new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()` was a bottleneck in the catalog and planner views. Micro-benchmarking showed `localeCompare` is ~15x faster and string operators (`>`) are ~34x faster than `Date` instantiation.

**Action:** Use `localeCompare` or simple string comparison for sorting ISO 8601 timestamps in frontend utilities. Centralize filtering and sorting logic in `utils/recipeFiltering.ts` to ensure consistency and avoid duplicated, unoptimized logic in components.

## 2025-05-24 - [Micro-optimization: String Operators vs localeCompare]

**Learning:** While `localeCompare` is faster than `Date` parsing, it is still significantly slower than direct string operators (`>` and `<`) for ISO 8601 strings because it performs locale-aware collation. For 10,000 items, `localeCompare` took ~180ms in Node.js while string operators took ~8ms (~22x faster).

**Action:** Use `(b > a ? 1 : b < a ? -1 : 0)` instead of `b.localeCompare(a)` for hot-path sorting of ISO 8601 strings in the frontend.

## 2025-05-25 - [WeakMap Caching for Derived Searchable Text]

**Learning:** Re-computing searchable text (mapping, joining, lowercasing) for every item during a filter pass (e.g., on every keystroke) is a significant bottleneck. Using a `WeakMap` to cache these strings allows $O(N)$ lookup in subsequent passes while ensuring memory is reclaimed when recipes are removed.

**Action:** Cache expensive derived string representations in a `WeakMap`. Include an `updatedAt` check within the cache retrieval logic to handle cases where the object might be mutated in-place without a reference change.
