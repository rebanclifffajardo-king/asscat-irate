-- =============================================================================
-- ASSCAT iRATE — Administrator functions (periods, imports, analytics,
-- notifications). Every function re-checks is_admin() server-side.
-- =============================================================================

create or replace function public._require_admin()
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Academic periods
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_current_period(p_period_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public._require_admin();
  if not exists (select 1 from public.academic_periods where id = p_period_id) then
    raise exception 'Academic period not found' using errcode = 'P0002';
  end if;
  update public.academic_periods set is_current = false where is_current and id <> p_period_id;
  update public.academic_periods set is_current = true where id = p_period_id;
end;
$$;

create or replace function public.admin_release_results(p_period_id uuid, p_release boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_label text;
begin
  perform public._require_admin();
  update public.academic_periods
     set results_released_at = case when p_release then coalesce(results_released_at, now()) end
   where id = p_period_id
  returning label into v_label;
  if v_label is null then
    raise exception 'Academic period not found' using errcode = 'P0002';
  end if;

  if p_release then
    insert into public.notifications (user_id, title, message, type, link, dedupe_key)
    select distinct f.profile_id, 'Evaluation results released',
           'Your evaluation results for ' || v_label || ' are now available.',
           'success', '/faculty/results', 'results-released:' || p_period_id
    from public.subject_offerings o
    join public.faculty f on f.id = o.faculty_id
    where o.academic_period_id = p_period_id and o.deleted_at is null and f.profile_id is not null
    on conflict (user_id, dedupe_key) do nothing;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reset (delete) a student's evaluation attempt so it can be answered again.
-- -----------------------------------------------------------------------------
create or replace function public.admin_reset_evaluation(p_attempt_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_info jsonb;
begin
  perform public._require_admin();
  select jsonb_build_object('student_number', s.student_number, 'subject_code', sub.code,
                            'offering_id', a.offering_id, 'status', a.status)
    into v_info
  from public.evaluation_attempts a
  join public.students s on s.id = a.student_id
  join public.subject_offerings o on o.id = a.offering_id
  join public.subjects sub on sub.id = o.subject_id
  where a.id = p_attempt_id;
  if v_info is null then
    raise exception 'Evaluation attempt not found' using errcode = 'P0002';
  end if;
  delete from public.evaluation_attempts where id = p_attempt_id;
  return v_info;
end;
$$;

-- -----------------------------------------------------------------------------
-- Import: course file (subjects, offerings, enrollments). Atomic.
-- Rows: [{subject_code, subject_title, faculty_number, program_code,
--         student_number, start_year, semester, section}]
-- -----------------------------------------------------------------------------
create or replace function public.admin_import_course_rows(p_rows jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  r                 record;
  v_subject         uuid;
  v_faculty         uuid;
  v_program         uuid;
  v_student         uuid;
  v_period          uuid;
  v_offering        uuid;
  v_subjects_new    int := 0;
  v_offerings_new   int := 0;
  v_enroll_new      int := 0;
  v_enroll_existing int := 0;
  v_row             int := 0;
begin
  perform public._require_admin();
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'No rows to import' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 20000 then
    raise exception 'Too many rows in a single import (maximum 20000)' using errcode = '22023';
  end if;

  for r in
    select * from jsonb_to_recordset(p_rows) as x(
      subject_code text, subject_title text, faculty_number text, program_code text,
      student_number text, start_year int, semester int, section text)
  loop
    v_row := v_row + 1;

    select id into v_period from public.academic_periods
     where start_year = r.start_year and semester = r.semester;
    if v_period is null then
      raise exception 'Row %: no survey schedule exists for S.Y. %-% semester %', v_row, r.start_year, r.start_year + 1, r.semester
        using errcode = '23503';
    end if;

    select id into v_faculty from public.faculty where upper(faculty_number) = upper(trim(r.faculty_number));
    if v_faculty is null then
      raise exception 'Row %: faculty ID % not found', v_row, r.faculty_number using errcode = '23503';
    end if;

    select id into v_program from public.programs where upper(code) = upper(trim(r.program_code));
    if v_program is null then
      raise exception 'Row %: program % not found', v_row, r.program_code using errcode = '23503';
    end if;

    select id into v_student from public.students where upper(student_number) = upper(trim(r.student_number));
    if v_student is null then
      raise exception 'Row %: student ID % not found', v_row, r.student_number using errcode = '23503';
    end if;

    select id into v_subject from public.subjects where upper(code) = upper(trim(r.subject_code));
    if v_subject is null then
      insert into public.subjects (code, title, created_by)
      values (upper(trim(r.subject_code)), trim(r.subject_title), auth.uid())
      returning id into v_subject;
      v_subjects_new := v_subjects_new + 1;
    end if;

    select id into v_offering from public.subject_offerings
     where subject_id = v_subject and faculty_id = v_faculty and academic_period_id = v_period
       and upper(section) = upper(coalesce(trim(r.section), '')) and deleted_at is null;
    if v_offering is null then
      insert into public.subject_offerings (subject_id, faculty_id, program_id, academic_period_id, section, created_by)
      values (v_subject, v_faculty, v_program, v_period, upper(coalesce(trim(r.section), '')), auth.uid())
      returning id into v_offering;
      v_offerings_new := v_offerings_new + 1;
    end if;

    insert into public.subject_enrollments (offering_id, student_id, created_by)
    values (v_offering, v_student, auth.uid())
    on conflict (offering_id, student_id) do nothing;
    if found then v_enroll_new := v_enroll_new + 1; else v_enroll_existing := v_enroll_existing + 1; end if;
  end loop;

  return jsonb_build_object('rows', v_row, 'subjects_created', v_subjects_new,
                            'offerings_created', v_offerings_new, 'enrollments_created', v_enroll_new,
                            'enrollments_existing', v_enroll_existing);
end;
$$;

-- -----------------------------------------------------------------------------
-- Import: historical evaluations. Atomic. Existing attempts are preserved
-- (skipped), never overwritten. Missing enrollments are created because a
-- historical evaluation implies enrollment.
-- Rows: [{student_number, subject_code, faculty_number, start_year, semester,
--         section, question_id, rating, comment, submitted_at}]
-- -----------------------------------------------------------------------------
create or replace function public.admin_import_evaluation_rows(p_rows jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  g           record;
  v_offering  uuid;
  v_period    uuid;
  v_student   uuid;
  v_attempt   uuid;
  v_scale     jsonb := coalesce(public.get_setting('rating_scale'), '[]'::jsonb);
  v_scale_max int;
  v_created   int := 0;
  v_skipped   int := 0;
  v_answers   int := 0;
  v_enrolled  int := 0;
begin
  perform public._require_admin();
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'No rows to import' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 50000 then
    raise exception 'Too many rows in a single import (maximum 50000)' using errcode = '22023';
  end if;
  select coalesce(max((x ->> 'value')::int), 5) into v_scale_max from jsonb_array_elements(v_scale) x;

  create temporary table _eval_rows on commit drop as
  select upper(trim(x.student_number)) as student_number, upper(trim(x.subject_code)) as subject_code,
         upper(trim(x.faculty_number)) as faculty_number, x.start_year, x.semester,
         upper(coalesce(trim(x.section), '')) as section, x.question_id, x.rating,
         nullif(trim(coalesce(x.comment, '')), '') as comment, x.submitted_at
  from jsonb_to_recordset(p_rows) as x(
    student_number text, subject_code text, faculty_number text, start_year int, semester int,
    section text, question_id uuid, rating int, comment text, submitted_at timestamptz);

  if exists (select 1 from _eval_rows where rating is null or rating < 1 or rating > v_scale_max) then
    raise exception 'Ratings must be between 1 and %', v_scale_max using errcode = '22023';
  end if;
  if exists (select 1 from _eval_rows r where not exists (select 1 from public.questions q where q.id = r.question_id)) then
    raise exception 'One or more questions do not exist' using errcode = '23503';
  end if;

  for g in
    select student_number, subject_code, faculty_number, start_year, semester, section,
           max(comment) as comment, max(submitted_at) as submitted_at
    from _eval_rows
    group by student_number, subject_code, faculty_number, start_year, semester, section
  loop
    select ap.id into v_period from public.academic_periods ap
     where ap.start_year = g.start_year and ap.semester = g.semester;
    select o.id into v_offering
    from public.subject_offerings o
    join public.subjects s on s.id = o.subject_id
    join public.faculty f on f.id = o.faculty_id
    where o.academic_period_id = v_period and o.deleted_at is null
      and upper(s.code) = g.subject_code and upper(f.faculty_number) = g.faculty_number
      and upper(o.section) = g.section;
    if v_offering is null then
      raise exception 'No class found for % / % (S.Y. %-%, semester %, section "%")',
        g.subject_code, g.faculty_number, g.start_year, g.start_year + 1, g.semester, g.section using errcode = '23503';
    end if;
    select id into v_student from public.students where upper(student_number) = g.student_number;
    if v_student is null then
      raise exception 'Student ID % not found', g.student_number using errcode = '23503';
    end if;

    if exists (select 1 from public.evaluation_attempts
               where offering_id = v_offering and student_id = v_student) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.subject_enrollments (offering_id, student_id, created_by)
    values (v_offering, v_student, auth.uid())
    on conflict (offering_id, student_id) do nothing;
    if found then v_enrolled := v_enrolled + 1; end if;

    insert into public.evaluation_attempts (offering_id, student_id, academic_period_id, source, started_at)
    values (v_offering, v_student, v_period, 'import', coalesce(g.submitted_at, now()))
    returning id into v_attempt;

    insert into public.evaluation_answers
      (attempt_id, question_id, category_id, rating, scale_max, rating_label, category_name, question_title, question_text)
    select distinct on (q.id) v_attempt, q.id, c.id, r.rating, v_scale_max,
           (select x ->> 'label' from jsonb_array_elements(v_scale) x where (x ->> 'value')::int = r.rating limit 1),
           c.name, q.title, q.content
    from _eval_rows r
    join public.questions q on q.id = r.question_id
    join public.question_categories c on c.id = q.category_id
    where r.student_number = g.student_number and r.subject_code = g.subject_code
      and r.faculty_number = g.faculty_number and r.start_year = g.start_year
      and r.semester = g.semester and r.section = g.section
    order by q.id;
    get diagnostics v_answers = row_count;

    if g.comment is not null then
      insert into public.evaluation_comments (attempt_id, comment) values (v_attempt, left(g.comment, 3000));
    end if;

    update public.evaluation_attempts
       set status = 'completed', submitted_at = coalesce(g.submitted_at, now()),
           average_rating = (select round(avg(rating), 3) from public.evaluation_answers where attempt_id = v_attempt)
     where id = v_attempt;
    v_created := v_created + 1;
  end loop;

  return jsonb_build_object('evaluations_created', v_created, 'evaluations_skipped', v_skipped,
                            'enrollments_created', v_enrolled);
end;
$$;

-- -----------------------------------------------------------------------------
-- Descriptive analytics for the admin dashboard and reports.
-- Filters on department/program apply to the class (offering) program.
-- Trend series ignore the period filters but honor all other filters.
-- Faculty age / years of service are computed at the time of the evaluation
-- period (never stored).
-- -----------------------------------------------------------------------------
create or replace function public.admin_analytics(
  p_period_id     uuid default null,
  p_start_year    int  default null,
  p_semester      int  default null,
  p_department_id uuid default null,
  p_program_id    uuid default null,
  p_faculty_id    uuid default null,
  p_subject_id    uuid default null
)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_min    int := public.min_respondents();
  v_result jsonb;
begin
  perform public._require_admin();

  with
  base_off as (
    select o.id, o.subject_id, o.faculty_id, o.program_id, o.academic_period_id,
           p.department_id, ap.start_year, ap.semester, ap.label, ap.school_year, ap.open_at
    from public.subject_offerings o
    join public.programs p on p.id = o.program_id
    join public.academic_periods ap on ap.id = o.academic_period_id
    where o.deleted_at is null
      and (p_department_id is null or p.department_id = p_department_id)
      and (p_program_id is null or o.program_id = p_program_id)
      and (p_faculty_id is null or o.faculty_id = p_faculty_id)
      and (p_subject_id is null or o.subject_id = p_subject_id)
  ),
  off as (
    select * from base_off
    where (p_period_id is null or academic_period_id = p_period_id)
      and (p_start_year is null or start_year = p_start_year)
      and (p_semester is null or semester = p_semester)
  ),
  enr as (
    select e.id, e.offering_id, e.student_id, s.program_id as student_program_id,
           sp.department_id as student_department_id, s.year_level_id,
           a.status, a.submitted_at
    from public.subject_enrollments e
    join off o on o.id = e.offering_id
    join public.students s on s.id = e.student_id
    join public.programs sp on sp.id = s.program_id
    left join public.evaluation_attempts a on a.offering_id = e.offering_id and a.student_id = e.student_id
  ),
  att as (
    select a.id, a.offering_id, a.submitted_at, o.faculty_id, o.department_id, o.program_id,
           o.subject_id, o.academic_period_id, o.open_at
    from public.evaluation_attempts a
    join off o on o.id = a.offering_id
    where a.status = 'completed'
  ),
  ans as (
    select x.rating, x.category_name, x.question_title, x.question_text, x.question_id, a.*
    from public.evaluation_answers x
    join att a on a.id = x.attempt_id
  ),
  trend_ans as (
    select x.rating, o.academic_period_id, o.label, o.start_year, o.semester, o.school_year, o.subject_id, a.id as attempt_id
    from public.evaluation_answers x
    join public.evaluation_attempts a on a.id = x.attempt_id and a.status = 'completed'
    join base_off o on o.id = a.offering_id
  ),
  fac as (
    select f.id, public.format_person_name(f.first_name, f.middle_name, f.last_name) as name,
           f.faculty_number, f.birthday, f.date_started, d.code as department_code, d.name as department_name
    from public.faculty f join public.departments d on d.id = f.department_id
  )
  select jsonb_build_object(
    'min_respondents', v_min,
    'kpis', jsonb_build_object(
      'total_students', (select count(*) from public.students where is_active),
      'total_faculty', (select count(*) from public.faculty where is_active),
      'total_programs', (select count(*) from public.programs where is_active),
      'total_departments', (select count(*) from public.departments where is_active),
      'offerings', (select count(*) from off),
      'expected', (select count(*) from enr),
      'completed', (select count(*) from enr where status = 'completed'),
      'in_progress', (select count(*) from enr where status = 'in_progress'),
      'not_started', (select count(*) from enr where status is null),
      'respondents', (select count(*) from att),
      'average_rating', (select round(avg(rating), 2) from ans),
      'faculty_evaluated', (select count(distinct faculty_id) from att)
    ),
    'rating_by_period', coalesce((select jsonb_agg(x order by x.start_year, x.semester) from (
        select label, start_year, semester, round(avg(rating), 2) as average,
               count(distinct attempt_id)::int as respondents
        from trend_ans group by label, start_year, semester) x), '[]'::jsonb),
    'rating_by_school_year', coalesce((select jsonb_agg(x order by x.school_year) from (
        select school_year, round(avg(rating), 2) as average, count(distinct attempt_id)::int as respondents
        from trend_ans group by school_year) x), '[]'::jsonb),
    'top_faculty', coalesce((select jsonb_agg(x order by x.average desc, x.respondents desc) from (
        select f.id, f.name, f.faculty_number, f.department_code, f.department_name,
               round(avg(a.rating), 2) as average, count(distinct a.id)::int as respondents
        from ans a join fac f on f.id = a.faculty_id
        group by f.id, f.name, f.faculty_number, f.department_code, f.department_name
        having count(distinct a.id) >= v_min
        order by avg(a.rating) desc, count(distinct a.id) desc limit 10) x), '[]'::jsonb),
    'faculty_below_threshold', (select count(*) from (
        select faculty_id from att group by faculty_id having count(*) < v_min) x),
    'faculty_respondents', coalesce((select jsonb_agg(x order by x.respondents desc, x.name) from (
        select f.id, f.name, f.department_code,
               (select count(*) from enr e join off o on o.id = e.offering_id where o.faculty_id = f.id)::int as expected,
               (select count(*) from att t where t.faculty_id = f.id)::int as respondents,
               (select round(avg(a.rating), 2) from ans a where a.faculty_id = f.id) as average
        from fac f where f.id in (select faculty_id from off)) x), '[]'::jsonb),
    'by_department', coalesce((select jsonb_agg(x order by x.code) from (
        select d.id, d.code, d.name,
               (select round(avg(a.rating), 2) from ans a where a.department_id = d.id) as average,
               (select count(*) from att t where t.department_id = d.id)::int as evaluations,
               (select count(*) from enr e join off o on o.id = e.offering_id where o.department_id = d.id)::int as expected
        from public.departments d
        where d.id in (select department_id from off)) x), '[]'::jsonb),
    'by_program', coalesce((select jsonb_agg(x order by x.code) from (
        select p.id, p.code, p.name,
               (select round(avg(a.rating), 2) from ans a where a.program_id = p.id) as average,
               (select count(*) from att t where t.program_id = p.id)::int as evaluations
        from public.programs p
        where p.id in (select program_id from off)) x), '[]'::jsonb),
    'participation_by_program', coalesce((select jsonb_agg(x order by x.code) from (
        select p.code, p.name, count(*)::int as expected,
               count(*) filter (where e.status = 'completed')::int as completed
        from enr e join public.programs p on p.id = e.student_program_id
        group by p.code, p.name) x), '[]'::jsonb),
    'participation_by_department', coalesce((select jsonb_agg(x order by x.code) from (
        select d.code, d.name, count(*)::int as expected,
               count(*) filter (where e.status = 'completed')::int as completed
        from enr e join public.departments d on d.id = e.student_department_id
        group by d.code, d.name) x), '[]'::jsonb),
    'completion_by_year_level', coalesce((select jsonb_agg(x order by x.sort_order) from (
        select y.name, y.sort_order, count(*)::int as expected,
               count(*) filter (where e.status = 'completed')::int as completed
        from enr e join public.year_levels y on y.id = e.year_level_id
        group by y.name, y.sort_order) x), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(x order by x.average desc) from (
        select category_name as name, round(avg(rating), 2) as average, count(*)::int as responses
        from ans group by category_name) x), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(x order by x.category, x.average desc) from (
        select category_name as category, question_title as title, question_text as content,
               round(avg(rating), 2) as average, count(*)::int as responses
        from ans group by category_name, question_title, question_text) x), '[]'::jsonb),
    'distribution', coalesce((select jsonb_agg(x order by x.rating) from (
        select rating, count(*)::int as count from ans group by rating) x), '[]'::jsonb),
    'age_ranges', coalesce((select jsonb_agg(x order by x.sort) from (
        select bucket as label, min(sort) as sort, round(avg(rating), 2) as average,
               count(distinct faculty_id)::int as faculty, count(distinct id)::int as respondents
        from (
          select a.rating, a.faculty_id, a.id, v.age,
                 case when v.age < 25 then 'Below 25' when v.age < 35 then '25–34'
                      when v.age < 45 then '35–44' when v.age < 55 then '45–54' else '55+' end as bucket,
                 case when v.age < 25 then 1 when v.age < 35 then 2
                      when v.age < 45 then 3 when v.age < 55 then 4 else 5 end as sort
          from ans a join fac f on f.id = a.faculty_id
          cross join lateral (select extract(year from age(a.open_at::date, f.birthday))::int as age) v
          where f.birthday is not null
        ) b group by bucket) x), '[]'::jsonb),
    'service_ranges', coalesce((select jsonb_agg(x order by x.sort) from (
        select bucket as label, min(sort) as sort, round(avg(rating), 2) as average,
               count(distinct faculty_id)::int as faculty, count(distinct id)::int as respondents
        from (
          select a.rating, a.faculty_id, a.id,
                 case when v.yrs < 1 then 'Less than 1 year' when v.yrs <= 3 then '1–3 years'
                      when v.yrs <= 6 then '4–6 years' when v.yrs <= 10 then '7–10 years'
                      else 'More than 10 years' end as bucket,
                 case when v.yrs < 1 then 1 when v.yrs <= 3 then 2 when v.yrs <= 6 then 3
                      when v.yrs <= 10 then 4 else 5 end as sort
          from ans a join fac f on f.id = a.faculty_id
          cross join lateral (select extract(year from age(a.open_at::date, f.date_started))::int as yrs) v
          where f.date_started is not null and f.date_started <= a.open_at::date
        ) b group by bucket) x), '[]'::jsonb),
    'subject_trends', coalesce((select jsonb_agg(x order by x.start_year, x.semester, x.subject_code) from (
        select s.code as subject_code, t.label, t.start_year, t.semester, round(avg(t.rating), 2) as average
        from trend_ans t join public.subjects s on s.id = t.subject_id
        where t.subject_id in (
          select subject_id from trend_ans group by subject_id order by count(distinct attempt_id) desc limit 5)
        group by s.code, t.label, t.start_year, t.semester) x), '[]'::jsonb),
    'submissions_by_date', coalesce((select jsonb_agg(x order by x.day) from (
        select (submitted_at at time zone 'Asia/Manila')::date as day, count(*)::int as count
        from att group by 1) x), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Time-based notifications. Idempotent thanks to (user_id, dedupe_key).
-- Run by the Vercel cron endpoint (service role) and opportunistically by
-- admins when the dashboard loads.
-- -----------------------------------------------------------------------------
create or replace function public.generate_scheduled_notifications()
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_days  int := coalesce((public.get_setting('deadline_reminder_days') #>> '{}')::int, 3);
  v_count int := 0;
  v_n     int;
  p       record;
begin
  if not (public.is_admin() or coalesce(auth.jwt() ->> 'role', '') = 'service_role') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  for p in select * from public.academic_periods where close_at > now() - interval '30 days' loop
    -- Period started
    if now() between p.open_at and p.close_at then
      insert into public.notifications (user_id, title, message, type, link, dedupe_key)
      select pr.id, 'Evaluation period started', p.label || ' evaluation is now open.', 'info',
             '/admin/surveys', 'period-open:' || p.id
      from public.profiles pr where pr.role = 'admin' and pr.is_active
      on conflict (user_id, dedupe_key) do nothing;
      get diagnostics v_n = row_count; v_count := v_count + v_n;

      insert into public.notifications (user_id, title, message, type, link, dedupe_key)
      select distinct s.profile_id, 'New evaluation available',
             'Faculty evaluations for ' || p.label || ' are now open. Please evaluate your instructors.',
             'info', '/student/dashboard', 'eval-open:' || p.id
      from public.subject_enrollments e
      join public.subject_offerings o on o.id = e.offering_id and o.deleted_at is null
      join public.students s on s.id = e.student_id
      where o.academic_period_id = p.id and s.profile_id is not null and s.is_active
      on conflict (user_id, dedupe_key) do nothing;
      get diagnostics v_n = row_count; v_count := v_count + v_n;
    end if;

    -- Closing soon
    if now() between p.close_at - make_interval(days => v_days) and p.close_at then
      insert into public.notifications (user_id, title, message, type, link, dedupe_key)
      select pr.id, 'Survey nearing closing date',
             p.label || ' closes on ' || to_char(p.close_at at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM') || '.',
             'warning', '/admin/surveys', 'period-closing:' || p.id
      from public.profiles pr where pr.role = 'admin' and pr.is_active
      on conflict (user_id, dedupe_key) do nothing;
      get diagnostics v_n = row_count; v_count := v_count + v_n;

      insert into public.notifications (user_id, title, message, type, link, dedupe_key)
      select distinct s.profile_id, 'Evaluation deadline approaching',
             'You still have pending evaluations. The evaluation closes on '
               || to_char(p.close_at at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM') || '.',
             'warning', '/student/dashboard', 'eval-deadline:' || p.id
      from public.subject_enrollments e
      join public.subject_offerings o on o.id = e.offering_id and o.deleted_at is null
      join public.students s on s.id = e.student_id
      where o.academic_period_id = p.id and s.profile_id is not null and s.is_active
        and not exists (select 1 from public.evaluation_attempts a
                        where a.offering_id = e.offering_id and a.student_id = e.student_id and a.status = 'completed')
      on conflict (user_id, dedupe_key) do nothing;
      get diagnostics v_n = row_count; v_count := v_count + v_n;
    end if;

    -- Closed
    if now() > p.close_at then
      insert into public.notifications (user_id, title, message, type, link, dedupe_key)
      select pr.id, 'Evaluation period closed', p.label || ' evaluation has closed.', 'info',
             '/admin/reports', 'period-closed:' || p.id
      from public.profiles pr where pr.role = 'admin' and pr.is_active
      on conflict (user_id, dedupe_key) do nothing;
      get diagnostics v_n = row_count; v_count := v_count + v_n;

      if coalesce(public.get_setting('results_visibility') #>> '{}', 'after_close') = 'after_close' then
        insert into public.notifications (user_id, title, message, type, link, dedupe_key)
        select distinct f.profile_id, 'Evaluation results released',
               'Your evaluation results for ' || p.label || ' are now available.',
               'success', '/faculty/results', 'results-released:' || p.id
        from public.subject_offerings o
        join public.faculty f on f.id = o.faculty_id
        where o.academic_period_id = p.id and o.deleted_at is null and f.profile_id is not null
        on conflict (user_id, dedupe_key) do nothing;
        get diagnostics v_n = row_count; v_count := v_count + v_n;
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;
