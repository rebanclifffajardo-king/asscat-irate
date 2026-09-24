-- =============================================================================
-- ASSCAT iRATE — Storage buckets and policies
-- Buckets are public-read (served by URL); writes are restricted.
-- SVG is intentionally not allowed (script injection risk).
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('faculty-photos', 'faculty-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars',        'avatars',        true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('system-assets',  'system-assets',  true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Faculty photos & system assets: administrators only.
create policy "Admins read managed images" on storage.objects for select to authenticated
  using (bucket_id in ('faculty-photos', 'system-assets') and (select public.is_admin()));
create policy "Admins upload managed images" on storage.objects for insert to authenticated
  with check (bucket_id in ('faculty-photos', 'system-assets') and (select public.is_admin()));
create policy "Admins update managed images" on storage.objects for update to authenticated
  using (bucket_id in ('faculty-photos', 'system-assets') and (select public.is_admin()));
create policy "Admins delete managed images" on storage.objects for delete to authenticated
  using (bucket_id in ('faculty-photos', 'system-assets') and (select public.is_admin()));

-- Avatars: each user manages files inside the folder named after their user id.
create policy "Users read own avatar" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users update own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
