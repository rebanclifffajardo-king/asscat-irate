-- =============================================================================
-- ASSCAT iRATE — Core schema
-- Normalized tables, constraints, indexes and integrity triggers.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Enumerations
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'faculty', 'student');
create type public.evaluation_status as enum ('in_progress', 'completed');

-- -----------------------------------------------------------------------------
-- Shared trigger: maintain updated_at
-- -----------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profiles (one per auth user). Role is the source of truth for authorization.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  role                 public.app_role not null,
  email                text not null,
  first_name           text,
  middle_name          text,
  last_name            text,
  avatar_path          text,
  is_active            boolean not null default true,
  must_change_password boolean not null default false,
  last_login_at        timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint profiles_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
create unique index profiles_email_key on public.profiles (lower(email));
create index profiles_role_idx on public.profiles (role);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Departments / Programs / Year levels
-- -----------------------------------------------------------------------------
create table public.departments (
  id         uuid primary key default gen_random_uuid(),
  code       text not null check (length(trim(code)) between 1 and 20),
  name       text not null check (length(trim(name)) between 1 and 150),
  is_active  boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index departments_code_key on public.departments (upper(code));
create unique index departments_name_key on public.departments (lower(name));
create trigger departments_updated_at before update on public.departments
  for each row execute function public.tg_set_updated_at();

create table public.programs (
  id            uuid primary key default gen_random_uuid(),
  code          text not null check (length(trim(code)) between 1 and 20),
  name          text not null check (length(trim(name)) between 1 and 200),
  department_id uuid not null references public.departments (id) on delete restrict,
  is_active     boolean not null default true,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Target for composite FKs that guarantee program/department consistency.
  constraint programs_id_department_key unique (id, department_id)
);
create unique index programs_code_key on public.programs (upper(code));
create index programs_department_idx on public.programs (department_id);
create trigger programs_updated_at before update on public.programs
  for each row execute function public.tg_set_updated_at();

create table public.year_levels (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 1 and 50),
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index year_levels_name_key on public.year_levels (lower(name));
create trigger year_levels_updated_at before update on public.year_levels
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Students
-- -----------------------------------------------------------------------------
create table public.students (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid unique references public.profiles (id) on delete set null,
  student_number text not null check (length(trim(student_number)) between 1 and 30),
  first_name     text not null check (length(trim(first_name)) between 1 and 100),
  middle_name    text,
  last_name      text not null check (length(trim(last_name)) between 1 and 100),
  email          text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  program_id     uuid not null references public.programs (id) on delete restrict,
  year_level_id  uuid not null references public.year_levels (id) on delete restrict,
  is_active      boolean not null default true,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index students_number_key on public.students (upper(student_number));
create unique index students_email_key on public.students (lower(email));
create index students_program_idx on public.students (program_id);
create index students_year_level_idx on public.students (year_level_id);
create trigger students_updated_at before update on public.students
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Faculty. Department is always derived from the selected program.
-- -----------------------------------------------------------------------------
create table public.faculty (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid unique references public.profiles (id) on delete set null,
  faculty_number text not null check (length(trim(faculty_number)) between 1 and 30),
  first_name     text not null check (length(trim(first_name)) between 1 and 100),
  middle_name    text,
  last_name      text not null check (length(trim(last_name)) between 1 and 100),
  email          text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  birthday       date,
  date_started   date,
  program_id     uuid not null,
  department_id  uuid not null,
  photo_path     text,
  is_active      boolean not null default true,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint faculty_program_department_fkey foreign key (program_id, department_id)
    references public.programs (id, department_id) on update cascade on delete restrict,
  constraint faculty_dates_check check (birthday is null or date_started is null or date_started > birthday)
);
create unique index faculty_number_key on public.faculty (upper(faculty_number));
create unique index faculty_email_key on public.faculty (lower(email));
create index faculty_department_idx on public.faculty (department_id);
create trigger faculty_updated_at before update on public.faculty
  for each row execute function public.tg_set_updated_at();

create or replace function public.tg_faculty_derive_department()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select p.department_id into new.department_id
  from public.programs p where p.id = new.program_id;
  if new.department_id is null then
    raise exception 'Program % does not exist', new.program_id using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger faculty_derive_department before insert or update of program_id, department_id on public.faculty
  for each row execute function public.tg_faculty_derive_department();

-- -----------------------------------------------------------------------------
-- Academic periods (school year + semester = one evaluation period)
-- -----------------------------------------------------------------------------
create table public.academic_periods (
  id                  uuid primary key default gen_random_uuid(),
  start_year          integer not null check (start_year between 2006 and 2100),
  semester            smallint not null check (semester in (1, 2)),
  open_at             timestamptz not null,
  close_at            timestamptz not null,
  is_current          boolean not null default false,
  results_released_at timestamptz,
  school_year         text generated always as (start_year::text || '-' || (start_year + 1)::text) stored,
  label               text generated always as (
    (case semester when 1 then '1st' else '2nd' end) || ' Semester of S.Y. '
    || start_year::text || '-' || (start_year + 1)::text
  ) stored,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint academic_periods_year_semester_key unique (start_year, semester),
  constraint academic_periods_date_range check (close_at > open_at)
);
-- Only one period may be the application's default/current period.
create unique index academic_periods_one_current on public.academic_periods (is_current) where is_current;
create trigger academic_periods_updated_at before update on public.academic_periods
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Subjects, offerings (a class taught by a faculty in a period) and enrollments
-- -----------------------------------------------------------------------------
create table public.subjects (
  id          uuid primary key default gen_random_uuid(),
  code        text not null check (length(trim(code)) between 1 and 30),
  title       text not null check (length(trim(title)) between 1 and 200),
  description text,
  units       numeric(3, 1) check (units is null or units between 0 and 12),
  is_active   boolean not null default true,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index subjects_code_key on public.subjects (upper(code));
create trigger subjects_updated_at before update on public.subjects
  for each row execute function public.tg_set_updated_at();

create table public.subject_offerings (
  id                 uuid primary key default gen_random_uuid(),
  subject_id         uuid not null references public.subjects (id) on delete restrict,
  faculty_id         uuid not null references public.faculty (id) on delete restrict,
  program_id         uuid not null references public.programs (id) on delete restrict,
  academic_period_id uuid not null references public.academic_periods (id) on delete restrict,
  section            text not null default '' check (length(section) <= 30),
  deleted_at         timestamptz,
  deleted_by         uuid references auth.users (id) on delete set null,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint subject_offerings_id_period_key unique (id, academic_period_id)
);
create unique index subject_offerings_active_key
  on public.subject_offerings (subject_id, faculty_id, academic_period_id, upper(section))
  where deleted_at is null;
create index subject_offerings_period_idx on public.subject_offerings (academic_period_id) where deleted_at is null;
create index subject_offerings_faculty_idx on public.subject_offerings (faculty_id);
create index subject_offerings_program_idx on public.subject_offerings (program_id);
create trigger subject_offerings_updated_at before update on public.subject_offerings
  for each row execute function public.tg_set_updated_at();

create table public.subject_enrollments (
  id          uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.subject_offerings (id) on delete restrict,
  student_id  uuid not null references public.students (id) on delete restrict,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint subject_enrollments_offering_student_key unique (offering_id, student_id)
);
create index subject_enrollments_student_idx on public.subject_enrollments (student_id);

-- -----------------------------------------------------------------------------
-- Question bank
-- -----------------------------------------------------------------------------
create table public.question_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 120),
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index question_categories_name_key on public.question_categories (lower(name));
create trigger question_categories_updated_at before update on public.question_categories
  for each row execute function public.tg_set_updated_at();

create table public.questions (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.question_categories (id) on delete restrict,
  title       text not null check (length(trim(title)) between 1 and 120),
  content     text not null check (length(trim(content)) between 1 and 1000),
  sort_order  integer not null default 0,
  is_required boolean not null default true,
  is_active   boolean not null default true,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index questions_category_idx on public.questions (category_id);
create trigger questions_updated_at before update on public.questions
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Evaluations
-- An attempt uniquely identifies student + offering + period. Composite FKs
-- guarantee the student is enrolled in the offering and that the period
-- matches the offering's period.
-- -----------------------------------------------------------------------------
create table public.evaluation_attempts (
  id                 uuid primary key default gen_random_uuid(),
  offering_id        uuid not null,
  student_id         uuid not null,
  academic_period_id uuid not null,
  status             public.evaluation_status not null default 'in_progress',
  started_at         timestamptz not null default now(),
  submitted_at       timestamptz,
  average_rating     numeric(5, 3),
  source             text not null default 'online' check (source in ('online', 'import')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint evaluation_attempts_unique_key unique (student_id, offering_id, academic_period_id),
  constraint evaluation_attempts_enrollment_fkey foreign key (offering_id, student_id)
    references public.subject_enrollments (offering_id, student_id) on delete restrict,
  constraint evaluation_attempts_offering_period_fkey foreign key (offering_id, academic_period_id)
    references public.subject_offerings (id, academic_period_id) on delete restrict,
  constraint evaluation_attempts_submitted_check check ((status = 'completed') = (submitted_at is not null))
);
create index evaluation_attempts_offering_idx on public.evaluation_attempts (offering_id, status);
create index evaluation_attempts_period_idx on public.evaluation_attempts (academic_period_id, status);
create index evaluation_attempts_submitted_idx on public.evaluation_attempts (submitted_at) where status = 'completed';
create trigger evaluation_attempts_updated_at before update on public.evaluation_attempts
  for each row execute function public.tg_set_updated_at();

-- Answers snapshot the question/category text so historical reports never
-- change when the question bank is later edited.
create table public.evaluation_answers (
  id             uuid primary key default gen_random_uuid(),
  attempt_id     uuid not null references public.evaluation_attempts (id) on delete cascade,
  question_id    uuid not null references public.questions (id) on delete restrict,
  category_id    uuid references public.question_categories (id) on delete set null,
  rating         smallint not null,
  scale_max      smallint not null default 5 check (scale_max between 2 and 10),
  rating_label   text,
  category_name  text not null,
  question_title text not null,
  question_text  text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint evaluation_answers_rating_range check (rating between 1 and scale_max),
  constraint evaluation_answers_attempt_question_key unique (attempt_id, question_id)
);
create index evaluation_answers_question_idx on public.evaluation_answers (question_id);
create index evaluation_answers_category_idx on public.evaluation_answers (category_name);
create trigger evaluation_answers_updated_at before update on public.evaluation_answers
  for each row execute function public.tg_set_updated_at();

create table public.evaluation_comments (
  id         uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.evaluation_attempts (id) on delete cascade,
  comment    text not null check (length(comment) between 1 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger evaluation_comments_updated_at before update on public.evaluation_comments
  for each row execute function public.tg_set_updated_at();

-- Completed evaluations are immutable: answers/comments of a completed attempt
-- cannot be changed by anyone. An administrator "reset" deletes the attempt
-- (cascade), which is allowed because the parent row is already gone.
create or replace function public.tg_lock_completed_evaluation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_attempt uuid := coalesce(new.attempt_id, old.attempt_id);
begin
  if exists (
    select 1 from public.evaluation_attempts a
    where a.id = v_attempt and a.status = 'completed'
  ) and coalesce(current_setting('app.allow_completed_write', true), '') <> 'on' then
    raise exception 'This evaluation has already been submitted and can no longer be modified'
      using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger evaluation_answers_lock before insert or update or delete on public.evaluation_answers
  for each row execute function public.tg_lock_completed_evaluation();
create trigger evaluation_comments_lock before insert or update or delete on public.evaluation_comments
  for each row execute function public.tg_lock_completed_evaluation();

-- A completed attempt can never go back to in_progress (reset = delete).
create or replace function public.tg_attempt_status_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'completed' and (
       new.status <> 'completed'
    or new.submitted_at is distinct from old.submitted_at
    or new.average_rating is distinct from old.average_rating
    or new.student_id <> old.student_id
    or new.offering_id <> old.offering_id
  ) then
    raise exception 'A submitted evaluation cannot be modified' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger evaluation_attempts_status_guard before update on public.evaluation_attempts
  for each row execute function public.tg_attempt_status_guard();

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  message    text not null,
  type       text not null default 'info' check (type in ('info', 'success', 'warning', 'error')),
  link       text check (link is null or link ~ '^/'),
  dedupe_key text,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_dedupe_key unique (user_id, dedupe_key)
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- -----------------------------------------------------------------------------
-- Activity log (append-only)
-- -----------------------------------------------------------------------------
create table public.activity_logs (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users (id) on delete set null,
  user_name   text,
  role        public.app_role,
  action      text not null,
  module      text not null,
  description text,
  entity_type text,
  entity_id   text,
  ip_address  text,
  user_agent  text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index activity_logs_created_idx on public.activity_logs (created_at desc);
create index activity_logs_user_idx on public.activity_logs (user_id, created_at desc);
create index activity_logs_module_idx on public.activity_logs (module, created_at desc);

create or replace function public.tg_activity_logs_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Activity logs are append-only' using errcode = 'P0001';
end;
$$;
create trigger activity_logs_append_only before update or delete on public.activity_logs
  for each row execute function public.tg_activity_logs_append_only();

-- -----------------------------------------------------------------------------
-- System settings (key/value)
-- -----------------------------------------------------------------------------
create table public.system_settings (
  key         text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  value       jsonb not null,
  description text,
  is_public   boolean not null default true,
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);
create trigger system_settings_updated_at before update on public.system_settings
  for each row execute function public.tg_set_updated_at();

insert into public.system_settings (key, value, description) values
  ('results_visibility', '"after_close"', 'When faculty may view results: immediate | after_close | manual'),
  ('min_respondents', '3', 'Minimum respondents before faculty see results and before faculty appear in rankings'),
  ('rating_scale', '[{"value":1,"label":"Poor"},{"value":2,"label":"Fair"},{"value":3,"label":"Good"},{"value":4,"label":"Very Good"},{"value":5,"label":"Excellent"}]', 'Likert rating scale used by the evaluation form'),
  ('allow_comments', 'true', 'Show the comments/suggestions box on the evaluation form'),
  ('require_comments', 'false', 'Require a comment before submitting'),
  ('deadline_reminder_days', '3', 'Days before close date to send deadline reminders'),
  ('institution_name', '"Agusan del Sur State College of Agriculture and Technology"', 'Institution name printed on reports'),
  ('institution_address', '"Bunawan, Agusan del Sur"', 'Institution address printed on reports'),
  ('system_name', '"ASSCAT iRATE"', 'Application display name');
