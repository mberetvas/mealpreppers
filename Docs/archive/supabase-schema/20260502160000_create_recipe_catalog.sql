create extension if not exists pgcrypto;

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text,
  source_url text,
  source_host text,
  image_url text,
  servings integer check (servings is null or servings > 0),
  prep_time_minutes integer check (prep_time_minutes is null or prep_time_minutes >= 0),
  cook_time_minutes integer check (cook_time_minutes is null or cook_time_minutes >= 0),
  total_time_minutes integer check (total_time_minutes is null or total_time_minutes >= 0),
  difficulty text,
  categories text[] not null default '{}',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  position integer not null check (position > 0),
  raw_text text not null check (length(trim(raw_text)) > 0),
  name text not null check (length(trim(name)) > 0),
  quantity numeric,
  unit text,
  created_at timestamptz not null default now(),
  unique (recipe_id, position)
);

create table if not exists public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  position integer not null check (position > 0),
  text text not null check (length(trim(text)) > 0),
  created_at timestamptz not null default now(),
  unique (recipe_id, position)
);

create index if not exists recipes_created_at_idx on public.recipes(created_at desc);
create index if not exists recipe_ingredients_recipe_id_position_idx on public.recipe_ingredients(recipe_id, position);
create index if not exists recipe_steps_recipe_id_position_idx on public.recipe_steps(recipe_id, position);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recipes_set_updated_at on public.recipes;
create trigger recipes_set_updated_at
before update on public.recipes
for each row execute function public.set_updated_at();

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;

revoke all on public.recipes from anon, authenticated;
revoke all on public.recipe_ingredients from anon, authenticated;
revoke all on public.recipe_steps from anon, authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.recipes to service_role;
grant select, insert, update, delete on public.recipe_ingredients to service_role;
grant select, insert, update, delete on public.recipe_steps to service_role;

drop policy if exists "service role manages recipes" on public.recipes;
create policy "service role manages recipes"
on public.recipes
for all
to service_role
using (true)
with check (true);

drop policy if exists "service role manages recipe ingredients" on public.recipe_ingredients;
create policy "service role manages recipe ingredients"
on public.recipe_ingredients
for all
to service_role
using (true)
with check (true);

drop policy if exists "service role manages recipe steps" on public.recipe_steps;
create policy "service role manages recipe steps"
on public.recipe_steps
for all
to service_role
using (true)
with check (true);