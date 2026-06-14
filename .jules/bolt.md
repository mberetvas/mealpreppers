## 2025-05-22 - [N+1 Query Optimization in Recipe Repository]

**Learning:** The `list_recipes` implementation in `src-tauri/src/shadow_server/recipe_catalog/repository.rs` followed a classic N+1 query pattern, fetching ingredients and steps one-by-one for each recipe. This is particularly costly in a local database context where many small queries add up, especially if the library grows large.

**Action:** Prefer batched queries using `IN` clauses and memory-side grouping with `HashMap` to fetch related entities in bulk. This reduces database round-trips from `1 + 2N` to exactly 3.

## 2025-05-23 - [Optimized ISO Date Sorting in Frontend]

**Learning:** Lexicographical string comparison of ISO 8601 strings is significantly faster than parsing them into `Date` objects. In this codebase, sorting recipes by `updatedAt` using `new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()` was a bottleneck in the catalog and planner views. Micro-benchmarking showed `localeCompare` is ~15x faster and string operators (`>`) are ~34x faster than `Date` instantiation.

**Action:** Use `localeCompare` or simple string comparison for sorting ISO 8601 timestamps in frontend utilities. Centralize filtering and sorting logic in `utils/recipeFiltering.ts` to ensure consistency and avoid duplicated, unoptimized logic in components.

## 2025-05-24 - [Optimizing Unique Option Retrieval with json_each]

**Learning:** Retrieving unique categories and tags by fetching all rows and deduplicating in Rust is O(N) and incurs high FFI and JSON parsing overhead. In SQLite, the `json_each` virtual table allows the database to flatten these arrays and deduplicate them via `DISTINCT` before the data even reaches the application layer.

**Action:** Use `SELECT DISTINCT value FROM table, json_each(json_column)` to extract unique values from JSON arrays in SQLite. This significantly reduces data transfer and memory allocations.

## 2025-05-24 - [Index Utilization in Batched Entity Loading]

**Learning:** When fetching related entities using a `WHERE recipe_id IN (?)` clause, SQLite cannot use a composite index `(recipe_id, position)` to satisfy a global `ORDER BY position`. This results in a "USE TEMP B-TREE FOR ORDER BY" query plan.

**Action:** Order by the full index prefix: `ORDER BY recipe_id, position`. This allows SQLite to perform an index scan, eliminating the need for a temporary sort. Since the entities are usually grouped by `recipe_id` in a `HashMap` on the Rust side anyway, this preserves correctness while maximizing database performance.
