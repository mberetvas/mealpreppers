-- Saved Weekplans ownership: optional auth user and/or anonymous session id.
-- Application uses service_role and filters by principal (RLS unchanged for service_role).
--
-- Legacy backfill: existing rows keep owner_user_id and anon_session_id NULL.
-- Those rows remain visible only via legacy /api/v1/planning/week-templates (no ownership filter).
-- New /api/v1/saved-weekplans routes only return rows owned by the current principal.

alter table public.meal_week_templates
  add column if not exists owner_user_id uuid references auth.users (id) on delete set null,
  add column if not exists anon_session_id text;

alter table public.meal_week_templates drop constraint if exists meal_week_templates_owner_shape;

alter table public.meal_week_templates
  add constraint meal_week_templates_owner_shape check (
    (owner_user_id is null and anon_session_id is null)
    or (owner_user_id is not null and anon_session_id is null)
    or (owner_user_id is null and anon_session_id is not null)
  );

comment on column public.meal_week_templates.owner_user_id is 'Authenticated owner; mutually exclusive with anon_session_id when set.';
comment on column public.meal_week_templates.anon_session_id is 'Opaque anonymous session key from server cookie; mutually exclusive with owner_user_id when set.';

create index if not exists meal_week_templates_owner_user_id_idx
  on public.meal_week_templates (owner_user_id)
  where owner_user_id is not null;

create index if not exists meal_week_templates_anon_session_id_idx
  on public.meal_week_templates (anon_session_id, updated_at desc)
  where anon_session_id is not null;
