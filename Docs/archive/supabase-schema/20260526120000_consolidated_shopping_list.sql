-- Saved consolidated shopping list persistence (issue #029).
-- Stores user-confirmed consolidated shopping list on the Saved Weekplan row.
-- JSON shape: { lines: [...], sourceFingerprint: string, confirmedAt: string }

alter table public.meal_week_templates
  add column if not exists consolidated_shopping_list jsonb;

comment on column public.meal_week_templates.consolidated_shopping_list is
  'Confirmed consolidated shopping list record: lines[], sourceFingerprint, confirmedAt. Null when no list has been confirmed.';
