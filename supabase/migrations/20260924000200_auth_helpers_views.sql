-- =============================================================================
-- ASSCAT iRATE — Auth integration, authorization helpers and read views
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER so they can be used inside RLS
-- policies without recursive policy evaluation).
-- -----------------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select p.role = 'admin' from public.profiles p where p.id = auth.uid() and p.is_active), false)
$$;

create or replace function public.current_student_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select s.id
  from public.students s
  join public.profiles p on p.id = s.profile_id
  where s.profile_id = auth.uid() and s.is_active and p.is_active and p.role = 'student'
$$;

create or replace function public.current_faculty_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select f.id
  from public.faculty f
  join public.profiles p on p.id = f.profile_id
  where f.profile_id = auth.uid() and f.is_active and p.is_active and p.role = 'faculty'
$$;

create or replace function public.format_person_name(p_first text, p_middle text, p_last text)
returns text
language sql immutable
set search_path = ''
as $$
  select concat_ws(' ', nullif(trim(p_first), ''),
                   nullif(upper(left(trim(coalesce(p_middle, '')), 1)) || '.', '.'),
                   nullif(trim(p_last), ''))
$$;

create or replace function public.period_status(p_open timestamptz, p_close timestamptz)
returns text
language sql stable
set search_path = ''
as $$
  select case when now() < p_open then 'upcoming' when now() > p_close then 'closed' else 'active' end
$$;

create or replace function public.get_setting(p_key text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select value from public.system_settings where key = p_key
$$;

-- -----------------------------------------------------------------------------
-- auth.users -> profiles. A profile is only created when the (server-only)
-- app_metadata carries a valid role, so public sign-ups never gain access.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_role text := new.raw_app_meta_data ->> 'role';
begin
  if v_role in ('admin', 'faculty', 'student') then
    insert into public.profiles (id, role, email, first_name, last_name, must_change_password)
    values (
      new.id, v_role::public.app_role, new.email,
      new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'last_name',
      coalesce((new.raw_app_meta_data ->> 'must_change_password')::boolean, false)
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.handle_auth_user_email_change();

-- profiles -> auth app_metadata so the JWT carries role/flags for fast routing.
-- (The database remains the source of truth for every authorization check.)
create or replace function public.tg_sync_profile_claims()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
       || jsonb_build_object('role', new.role, 'is_active', new.is_active,
                             'must_change_password', new.must_change_password)
   where id = new.id;
  return new;
end;
$$;
create trigger profiles_sync_claims after insert or update of role, is_active, must_change_password on public.profiles
  for each row execute function public.tg_sync_profile_claims();

-- Profile role must match the linked student/faculty record.
create or replace function public.tg_check_profile_link()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_expected public.app_role := case tg_table_name when 'students' then 'student' else 'faculty' end;
begin
  if new.profile_id is not null and not exists (
    select 1 from public.profiles p where p.id = new.profile_id and p.role = v_expected
  ) then
    raise exception 'Linked account must have the % role', v_expected using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger students_profile_link before insert or update of profile_id on public.students
  for each row execute function public.tg_check_profile_link();
create trigger faculty_profile_link before insert or update of profile_id on public.faculty
  for each row execute function public.tg_check_profile_link();

-- Users mark their own forced password change complete.
create or replace function public.complete_password_change()
returns void
language sql security definer
set search_path = ''
as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

create or replace function public.touch_last_login()
returns void
language sql security definer
set search_path = ''
as $$
  update public.profiles set last_login_at = now() where id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- Read views. security_invoker = true => the caller's RLS policies apply.
-- A search_text column allows safe single-column server-side search.
-- -----------------------------------------------------------------------------
create view public.department_overview with (security_invoker = true) as
select d.*,
       (select count(*) from public.programs p where p.department_id = d.id)::int as program_count,
       lower(concat_ws(' ', d.code, d.name)) as search_text
from public.departments d;

create view public.program_overview with (security_invoker = true) as
select p.*, d.code as department_code, d.name as department_name,
       lower(concat_ws(' ', p.code, p.name, d.code, d.name)) as search_text
from public.programs p
join public.departments d on d.id = p.department_id;

create view public.student_overview with (security_invoker = true) as
select s.*,
       public.format_person_name(s.first_name, s.middle_name, s.last_name) as full_name,
       concat_ws(', ', s.last_name, concat_ws(' ', s.first_name, s.middle_name)) as sort_name,
       p.code as program_code, p.name as program_name,
       d.id as department_id, d.code as department_code, d.name as department_name,
       y.name as year_level_name, y.sort_order as year_level_order,
       lower(concat_ws(' ', s.student_number, s.first_name, s.middle_name, s.last_name, s.email, p.code)) as search_text
from public.students s
join public.programs p on p.id = s.program_id
join public.departments d on d.id = p.department_id
join public.year_levels y on y.id = s.year_level_id;

create view public.faculty_overview with (security_invoker = true) as
select f.*,
       public.format_person_name(f.first_name, f.middle_name, f.last_name) as full_name,
       concat_ws(', ', f.last_name, concat_ws(' ', f.first_name, f.middle_name)) as sort_name,
       p.code as program_code, p.name as program_name,
       d.code as department_code, d.name as department_name,
       case when f.date_started is null then null
            else extract(year from age(current_date, f.date_started))::int end as years_of_service,
       case when f.birthday is null then null
            else extract(year from age(current_date, f.birthday))::int end as age,
       lower(concat_ws(' ', f.faculty_number, f.first_name, f.middle_name, f.last_name, f.email, p.code, d.code)) as search_text
from public.faculty f
join public.programs p on p.id = f.program_id
join public.departments d on d.id = f.department_id;

create view public.period_overview with (security_invoker = true) as
select ap.*, public.period_status(ap.open_at, ap.close_at) as status
from public.academic_periods ap;

create view public.category_overview with (security_invoker = true) as
select c.*,
       (select count(*) from public.questions q where q.category_id = c.id)::int as question_count,
       (select count(*) from public.questions q where q.category_id = c.id and q.is_active)::int as active_question_count,
       lower(concat_ws(' ', c.name, c.description)) as search_text
from public.question_categories c;

create view public.question_overview with (security_invoker = true) as
select q.*, c.name as category_name, c.is_active as category_is_active, c.sort_order as category_sort_order,
       exists (select 1 from public.evaluation_answers a where a.question_id = q.id) as is_used,
       lower(concat_ws(' ', q.title, q.content, c.name)) as search_text
from public.questions q
join public.question_categories c on c.id = q.category_id;

create view public.offering_overview with (security_invoker = true) as
select o.id, o.academic_period_id, o.section, o.subject_id, o.faculty_id, o.program_id, o.created_at,
       s.code as subject_code, s.title as subject_title,
       f.faculty_number, public.format_person_name(f.first_name, f.middle_name, f.last_name) as faculty_name,
       f.email as faculty_email, f.photo_path as faculty_photo_path,
       p.code as program_code, p.name as program_name,
       d.id as department_id, d.code as department_code, d.name as department_name,
       ap.label as period_label, ap.school_year, ap.semester, ap.start_year, ap.open_at, ap.close_at,
       coalesce(ec.enrolled, 0)::int as enrolled_count,
       coalesce(ac.completed, 0)::int as completed_count,
       coalesce(ac.in_progress, 0)::int as in_progress_count,
       case when coalesce(ec.enrolled, 0) = 0 then 0
            else round(100.0 * coalesce(ac.completed, 0) / ec.enrolled, 1) end as progress_pct,
       ac.average_rating,
       lower(concat_ws(' ', s.code, s.title, f.faculty_number, f.first_name, f.last_name, p.code, o.section)) as search_text
from public.subject_offerings o
join public.subjects s on s.id = o.subject_id
join public.faculty f on f.id = o.faculty_id
join public.programs p on p.id = o.program_id
join public.departments d on d.id = p.department_id
join public.academic_periods ap on ap.id = o.academic_period_id
left join lateral (select count(*) as enrolled from public.subject_enrollments e where e.offering_id = o.id) ec on true
left join lateral (
  select count(*) filter (where a.status = 'completed') as completed,
         count(*) filter (where a.status = 'in_progress') as in_progress,
         round(avg(a.average_rating) filter (where a.status = 'completed'), 2) as average_rating
  from public.evaluation_attempts a where a.offering_id = o.id
) ac on true
where o.deleted_at is null;

create view public.enrollment_overview with (security_invoker = true) as
select e.id, e.offering_id, e.student_id, e.created_at,
       s.student_number, public.format_person_name(s.first_name, s.middle_name, s.last_name) as student_name,
       concat_ws(', ', s.last_name, s.first_name) as sort_name, s.is_active as student_is_active,
       p.code as program_code, y.name as year_level_name, y.sort_order as year_level_order,
       a.id as attempt_id,
       case when a.status = 'completed' then 'completed'
            when a.status = 'in_progress' then 'in_progress'
            else 'pending' end as evaluation_status,
       a.average_rating, a.submitted_at, a.started_at,
       lower(concat_ws(' ', s.student_number, s.first_name, s.last_name, p.code)) as search_text
from public.subject_enrollments e
join public.students s on s.id = e.student_id
join public.programs p on p.id = s.program_id
join public.year_levels y on y.id = s.year_level_id
left join public.evaluation_attempts a on a.offering_id = e.offering_id and a.student_id = e.student_id;

create view public.activity_log_overview with (security_invoker = true) as
select l.*, lower(concat_ws(' ', l.user_name, l.action, l.module, l.description)) as search_text
from public.activity_logs l;
