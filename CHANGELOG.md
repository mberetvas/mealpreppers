# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Recipe catalog: **chip filters** for categories and tags, **sort** (Recently updated / Title A–Z), and split empty-state messaging (empty library vs no matches with "Clear filters" button).
- Recipe catalog bulk delete: **Select** mode on `/recipes`, multi-select cards, and `POST /api/v1/recipes/bulk-delete` with validated `{ ids }` payload.
- Recipe detail page at `/recipes/:id` (full recipe, loading/error states, back to catalog) and `GET /api/v1/recipes/:id` backed by the catalog repository.
- Add Recipe (manual entry): upload a recipe photo (JPEG, PNG, WebP, GIF up to 5MB); stored in Supabase Storage (`recipe-images`) with public read.
- Add recipe creation with manual entry and URL import preview for 15gram, Colruyt, Delhaize, Dagelijkse Kost, and Libelle Lekker.
- Add Supabase-backed recipe catalog tables, RLS policies, explicit service-role grants, and Nuxt server APIs for previewing, creating, and listing recipes.
- Shared `design-input`, `design-textarea`, `design-select` CSS component classes aligned with DESIGN.md input spec (bottom border, surface_container_lowest background, primary focus).
- Unit tests for `filterRecipes` and `emptyStateType` utility functions.

### Fixed
- Dagelijkse Kost import: recipe **title** is taken from `og:title` (or the page title) instead of the JSON-LD `name` field, which is a long SEO blurb; descriptions still come from structured data.
- Dagelijkse Kost URL import: the site only lists two preparation steps in JSON-LD; the preview API now loads full steps from the public Firestore `recipes/{id}` document when a storage URL in the page exposes the id (falls back to JSON-LD and warns if the extra fetch does not return more steps).
- Mobile bottom nav: the full-width `fixed` bar no longer intercepts touches outside the tab and FAB controls (`pointer-events-none` on the bar, `auto` on links), so taps on recipe content behind the bar area (and gaps) reach the page.
- Recipe catalog: `useRecipeTimeFormat` is resolved from `app/composables` so Nuxt 4 auto-imports it (root `composables/` is outside the app source root).
- Add Recipe page: sidebar and ingredient rows no longer overflow their cards (grid `min-w-0` and full-width inputs).

### Changed
- Recipe edit form inputs now use DESIGN.md bottom-border style instead of ring-based inputs.
- Ingredient rows use progressive disclosure: primary "As on your list" field visible by default, structured qty/unit/name behind expand toggle.
- Difficulty field is now a `<select>` (Easy / Medium / Hard) instead of free-text input.
- Bulk delete uses two-step in-app confirmation instead of `window.confirm()`, with focus management and a11y attributes.
- Card hover lift uses `ease-out` timing and is disabled via `motion-reduce:transform-none` for reduced-motion users.
- Recipe options defaults: category and tag seed lists now include Dutch labels next to the English set (`recipeDefaults`).
- Move Supabase access out of the browser shell and into server-only runtime configuration.