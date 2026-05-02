# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Recipe detail page at `/recipes/:id` (full recipe, loading/error states, back to catalog) and `GET /api/v1/recipes/:id` backed by the catalog repository.
- Add Recipe (manual entry): upload a recipe photo (JPEG, PNG, WebP, GIF up to 5MB); stored in Supabase Storage (`recipe-images`) with public read.
- Add recipe creation with manual entry and URL import preview for 15gram, Colruyt, Delhaize, Dagelijkse Kost, and Libelle Lekker.
- Add Supabase-backed recipe catalog tables, RLS policies, explicit service-role grants, and Nuxt server APIs for previewing, creating, and listing recipes.

### Fixed
- Mobile bottom nav: the full-width `fixed` bar no longer intercepts touches outside the tab and FAB controls (`pointer-events-none` on the bar, `auto` on links), so taps on recipe content behind the bar area (and gaps) reach the page.
- Recipe catalog: `useRecipeTimeFormat` is resolved from `app/composables` so Nuxt 4 auto-imports it (root `composables/` is outside the app source root).
- Add Recipe page: sidebar and ingredient rows no longer overflow their cards (grid `min-w-0` and full-width inputs).

### Changed
- Recipe options defaults: category and tag seed lists now include Dutch labels next to the English set (`recipeDefaults`).
- Move Supabase access out of the browser shell and into server-only runtime configuration.