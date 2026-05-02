# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Add recipe creation with manual entry and URL import preview for 15gram, Colruyt, Delhaize, Dagelijkse Kost, and Libelle Lekker.
- Add Supabase-backed recipe catalog tables, RLS policies, explicit service-role grants, and Nuxt server APIs for previewing, creating, and listing recipes.

### Changed
- Move Supabase access out of the browser shell and into server-only runtime configuration.