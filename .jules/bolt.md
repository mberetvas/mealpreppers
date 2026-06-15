## 2025-05-22 - [N+1 Query Optimization in Recipe Repository]

**Learning:** The `list_recipes` implementation in `src-tauri/src/shadow_server/recipe_catalog/repository.rs` followed a classic N+1 query pattern, fetching ingredients and steps one-by-one for each recipe. This is particularly costly in a local database context where many small queries add up, especially if the library grows large.

**Action:** Prefer batched queries using `IN` clauses and memory-side grouping with `HashMap` to fetch related entities in bulk. This reduces database round-trips from `1 + 2N` to exactly 3.

## 2025-05-23 - [Optimized ISO Date Sorting in Frontend]

**Learning:** Lexicographical string comparison of ISO 8601 strings is significantly faster than parsing them into `Date` objects. In this codebase, sorting recipes by `updatedAt` using `new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()` was a bottleneck in the catalog and planner views. Micro-benchmarking showed `localeCompare` is ~15x faster and string operators (`>`) are ~34x faster than `Date` instantiation.

**Action:** Use `localeCompare` or simple string comparison for sorting ISO 8601 timestamps in frontend utilities. Centralize filtering and sorting logic in `utils/recipeFiltering.ts` to ensure consistency and avoid duplicated, unoptimized logic in components.

## 2025-05-24 - [Offloading Deduplication to SQLite with json_each]

**Learning:** When retrieving unique values from a JSON array column (like `categories` or `tags`), fetching all rows and parsing/deduplicating in Rust is $O(N)$ and incurs high IPC/memory overhead. SQLite's `json_each` virtual table combined with `DISTINCT` allows the database engine to perform this unnesting and deduplication internally.

**Action:** Use `SELECT DISTINCT value FROM table, json_each(json_column)` to retrieve unique options from JSON arrays. This reduces the data transferred to Rust and avoids redundant allocations and parsing.

## 2025-05-24 - [Satisfying Composite Indexes in Batched IN Queries]

**Learning:** SQLite's composite index on `(recipe_id, position)` can only be used to avoid a sort when the query results are ordered by the same columns. In a batched query using `WHERE recipe_id IN (...)`, an `ORDER BY position` clause forces a temporary B-tree sort because `position` is not globally ordered across different `recipe_id` values.

**Action:** Use `ORDER BY recipe_id, position` in batched queries. This allows SQLite to use the index to return results in order, eliminating the `TEMP B-TREE` sort overhead. The application logic (mapping rows to parent entities via `HashMap`) remains unchanged but the database work is significantly reduced.
