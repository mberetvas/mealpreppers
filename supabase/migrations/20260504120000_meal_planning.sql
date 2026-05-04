-- Week templates and month plans (JSON documents). Service role only — no end-user auth yet.
-- Multi-user: add user_id + RLS when auth lands.

create table if not exists public.meal_week_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  body jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_month_plans (
  id uuid primary key default gen_random_uuid(),
  name text check (name is null or length(trim(name)) > 0),
  body jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meal_week_templates_updated_at_idx on public.meal_week_templates(updated_at desc);
create index if not exists meal_month_plans_updated_at_idx on public.meal_month_plans(updated_at desc);

drop trigger if exists meal_week_templates_set_updated_at on public.meal_week_templates;
create trigger meal_week_templates_set_updated_at
before update on public.meal_week_templates
for each row execute function public.set_updated_at();

drop trigger if exists meal_month_plans_set_updated_at on public.meal_month_plans;
create trigger meal_month_plans_set_updated_at
before update on public.meal_month_plans
for each row execute function public.set_updated_at();

alter table public.meal_week_templates enable row level security;
alter table public.meal_month_plans enable row level security;

revoke all on public.meal_week_templates from anon, authenticated;
revoke all on public.meal_month_plans from anon, authenticated;

grant select, insert, update, delete on public.meal_week_templates to service_role;
grant select, insert, update, delete on public.meal_month_plans to service_role;

drop policy if exists "service role manages meal week templates" on public.meal_week_templates;
create policy "service role manages meal week templates"
on public.meal_week_templates
for all
to service_role
using (true)
with check (true);

drop policy if exists "service role manages meal month plans" on public.meal_month_plans;
create policy "service role manages meal month plans"
on public.meal_month_plans
for all
to service_role
using (true)
with check (true);
