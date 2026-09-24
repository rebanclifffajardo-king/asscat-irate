-- =============================================================================
-- ASSCAT iRATE — Create profiles when the role arrives via an UPDATE
-- Supabase Auth's admin createUser inserts the auth.users row first and sets
-- app_metadata in a subsequent UPDATE, so the INSERT-only trigger never saw the
-- role. Also fire on updates of raw_app_meta_data (idempotent: on conflict do
-- nothing), and backfill any accounts created before this fix.
-- =============================================================================
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of raw_app_meta_data on auth.users
  for each row execute function public.handle_new_auth_user();

insert into public.profiles (id, role, email, first_name, last_name, must_change_password)
select u.id, (u.raw_app_meta_data ->> 'role')::public.app_role, u.email,
       u.raw_user_meta_data ->> 'first_name', u.raw_user_meta_data ->> 'last_name',
       coalesce((u.raw_app_meta_data ->> 'must_change_password')::boolean, false)
from auth.users u
where u.raw_app_meta_data ->> 'role' in ('admin', 'faculty', 'student')
  and not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
