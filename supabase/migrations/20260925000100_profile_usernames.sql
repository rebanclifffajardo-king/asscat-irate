-- =============================================================================
-- ASSCAT iRATE — Optional login usernames
-- Any account may have a username (e.g. developer/test accounts) usable at the
-- login screen in place of an email or Student/Faculty ID. Case-insensitive.
-- Users cannot change their own username (not in the column-level UPDATE grant).
-- =============================================================================
alter table public.profiles
  add column username text
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$');

create unique index profiles_username_key on public.profiles (lower(username));
