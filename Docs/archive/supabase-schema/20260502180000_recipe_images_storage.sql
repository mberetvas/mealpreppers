-- Public bucket for recipe photos uploaded from the add-recipe flow.
-- Server uploads via service role; anon users read images by public URL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-images',
  'recipe-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Recipe images public read" on storage.objects;

create policy "Recipe images public read"
on storage.objects
for select
to public
using (bucket_id = 'recipe-images');
