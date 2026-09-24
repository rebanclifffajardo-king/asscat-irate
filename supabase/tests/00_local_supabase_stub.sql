-- Minimal stand-in for the pieces of Supabase that the migrations depend on.
-- Used ONLY for local verification of migrations/RLS; not part of the project.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then
    create role anon nologin; create role authenticated nologin;
    create role service_role nologin bypassrls; create role authenticator noinherit login;
    grant anon, authenticated, service_role to authenticator;
  end if;
end $$;

create schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, email text unique,
  encrypted_password text, email_confirmed_at timestamptz, last_sign_in_at timestamptz,
  raw_app_meta_data jsonb default '{}'::jsonb, raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  confirmation_token text, email_change text, email_change_token_new text, recovery_token text,
  banned_until timestamptz
);
create table auth.identities (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade,
  provider_id text, identity_data jsonb, provider text, last_sign_in_at timestamptz,
  created_at timestamptz, updated_at timestamptz,
  email text generated always as (lower(identity_data ->> 'email')) stored
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create function auth.role() returns text language sql stable as $$
  select auth.jwt() ->> 'role'
$$;

create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets,
  name text, owner uuid, created_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant all on storage.objects to anon, authenticated, service_role;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

-- Supabase's default privileges on public
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
