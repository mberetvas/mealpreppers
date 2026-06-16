## 2025-05-22 - [N+1 Query Optimization in Recipe Repository]

**Learning:** The `list_recipes` implementation in `src-tauri/src/shadow_server/recipe_catalog/repository.rs` followed a classic N+1 query pattern, fetching ingredients and steps one-by-one for each recipe. This is particularly costly in a local database context where many small queries add up, especially if the library grows large.

**Action:** Prefer batched queries using `IN` clauses and memory-side grouping with `HashMap` to fetch related entities in bulk. This reduces database round-trips from `1 + 2N` to exactly 3.

## 2025-05-23 - [Optimized ISO Date Sorting in Frontend]

**Learning:** Lexicographical string comparison of ISO 8601 strings is significantly faster than parsing them into `Date` objects. In this codebase, sorting recipes by `updatedAt` using `new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()` was a bottleneck in the catalog and planner views. Micro-benchmarking showed `localeCompare` is ~15x faster and string operators (`>`) are ~34x faster than `Date` instantiation.

**Action:** Use `localeCompare` or simple string comparison for sorting ISO 8601 timestamps in frontend utilities. Centralize filtering and sorting logic in `utils/recipeFiltering.ts` to ensure consistency and avoid duplicated, unoptimized logic in components.

## 2025-05-24 - [Offloading JSON De-duplication to SQLite]

**Learning:** `list_stored_options` in the Rust repository was performing O(N) JSON parsing and string allocations to find unique categories/tags. SQLite's `json_each` and `DISTINCT` can handle this much more efficiently, reducing IPC and memory overhead.

**Action:** Use `list_stored_options` in the Rust repository is optimized using SQLite's `json_each` and `DISTINCT` to offload deduplication and avoid O(N) JSON parsing and string allocations in Rust.
