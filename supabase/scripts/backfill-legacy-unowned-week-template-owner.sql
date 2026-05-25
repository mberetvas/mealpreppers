-- One-off backfill when legacy_unowned rows must be retained under a known owner.
-- Replace placeholders before running. Run only after HITL decision in
-- Docs/audits/001-legacy-unowned-week-grid-rows.md.

-- Authenticated user owner (sets anon_session_id null per meal_week_templates_owner_shape):
-- update public.meal_week_templates
-- set owner_user_id = '<auth-user-uuid>',
--     anon_session_id = null
-- where owner_user_id is null
--   and anon_session_id is null
--   and id in ('<uuid>', '<uuid>');

-- Anonymous session owner:
-- update public.meal_week_templates
-- set owner_user_id = null,
--     anon_session_id = '<opaque-session-id>'
-- where owner_user_id is null
--   and anon_session_id is null
--   and id in ('<uuid>', '<uuid>');
