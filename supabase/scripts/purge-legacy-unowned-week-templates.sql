-- One-off purge for legacy_unowned rows (both owner columns null).
-- Run only after Docs/audits/001-legacy-unowned-week-grid-rows.md records delete-as-junk.
-- Prefer a transaction and verify count first:
--   select count(*) from public.meal_week_templates
--   where owner_user_id is null and anon_session_id is null;

delete from public.meal_week_templates
where owner_user_id is null
  and anon_session_id is null;
