-- =============================================================================
-- ASSCAT iRATE — Evaluation workflow functions
-- Students never write evaluation tables directly; every write goes through
-- these SECURITY DEFINER functions which enforce enrollment, period window,
-- scale range, required questions and duplicate protection.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Student: evaluations for a period (defaults to the current period)
-- -----------------------------------------------------------------------------
create or replace function public.get_student_evaluations(p_period_id uuid default null)
returns table (
  offering_id uuid, subject_code text, subject_title text, section text,
  faculty_name text, faculty_photo_path text,
  period_id uuid, period_label text, open_at timestamptz, close_at timestamptz,
  status text, started_at timestamptz, submitted_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_student uuid := public.current_student_id();
  v_period  uuid;
begin
  if v_student is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  v_period := coalesce(p_period_id, (select ap.id from public.academic_periods ap where ap.is_current));

  return query
  select o.id, s.code, s.title, o.section,
         public.format_person_name(f.first_name, f.middle_name, f.last_name), f.photo_path,
         ap.id, ap.label, ap.open_at, ap.close_at,
         case when a.status = 'completed' then 'completed'
              when now() < ap.open_at then 'upcoming'
              when now() > ap.close_at then 'closed'
              when a.status = 'in_progress' then 'in_progress'
              else 'not_started' end,
         a.started_at, a.submitted_at
  from public.subject_enrollments e
  join public.subject_offerings o on o.id = e.offering_id and o.deleted_at is null
  join public.subjects s on s.id = o.subject_id
  join public.faculty f on f.id = o.faculty_id
  join public.academic_periods ap on ap.id = o.academic_period_id
  left join public.evaluation_attempts a on a.offering_id = o.id and a.student_id = e.student_id
  where e.student_id = v_student and o.academic_period_id = v_period
  order by s.code, o.section;
end;
$$;

-- Periods the student has enrollments in (for the history selector).
create or replace function public.get_student_periods()
returns table (id uuid, label text, start_year int, semester smallint, is_current boolean)
language sql stable security definer
set search_path = ''
as $$
  select distinct ap.id, ap.label, ap.start_year, ap.semester, ap.is_current
  from public.subject_enrollments e
  join public.subject_offerings o on o.id = e.offering_id and o.deleted_at is null
  join public.academic_periods ap on ap.id = o.academic_period_id
  where e.student_id = public.current_student_id()
  order by ap.start_year desc, ap.semester desc
$$;

-- -----------------------------------------------------------------------------
-- Student: evaluation form payload
-- -----------------------------------------------------------------------------
create or replace function public.get_evaluation_form(p_offering_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_student uuid := public.current_student_id();
  v_result  jsonb;
  v_attempt public.evaluation_attempts;
begin
  if v_student is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.subject_enrollments e
    join public.subject_offerings o on o.id = e.offering_id and o.deleted_at is null
    where e.offering_id = p_offering_id and e.student_id = v_student
  ) then
    raise exception 'You are not enrolled in this subject' using errcode = '42501';
  end if;

  select * into v_attempt from public.evaluation_attempts a
  where a.offering_id = p_offering_id and a.student_id = v_student;

  select jsonb_build_object(
    'offering', jsonb_build_object('id', o.id, 'subject_code', s.code, 'subject_title', s.title,
                                   'section', o.section, 'program_code', p.code, 'program_name', p.name),
    'faculty', jsonb_build_object('name', public.format_person_name(f.first_name, f.middle_name, f.last_name),
                                  'photo_path', f.photo_path, 'department_name', d.name),
    'period', jsonb_build_object('id', ap.id, 'label', ap.label, 'school_year', ap.school_year,
                                 'semester', ap.semester, 'open_at', ap.open_at, 'close_at', ap.close_at,
                                 'status', public.period_status(ap.open_at, ap.close_at))
  ) into v_result
  from public.subject_offerings o
  join public.subjects s on s.id = o.subject_id
  join public.faculty f on f.id = o.faculty_id
  join public.departments d on d.id = f.department_id
  join public.programs p on p.id = o.program_id
  join public.academic_periods ap on ap.id = o.academic_period_id
  where o.id = p_offering_id;

  v_result := v_result || jsonb_build_object(
    'scale', coalesce(public.get_setting('rating_scale'), '[]'::jsonb),
    'allow_comments', coalesce((public.get_setting('allow_comments'))::text::boolean, true),
    'require_comments', coalesce((public.get_setting('require_comments'))::text::boolean, false),
    'attempt', case when v_attempt.id is null then null else jsonb_build_object(
        'status', v_attempt.status, 'started_at', v_attempt.started_at,
        'submitted_at', v_attempt.submitted_at, 'updated_at', v_attempt.updated_at) end,
    'comment', (select c.comment from public.evaluation_comments c where c.attempt_id = v_attempt.id),
    'answers', coalesce((select jsonb_object_agg(a.question_id, a.rating)
                         from public.evaluation_answers a where a.attempt_id = v_attempt.id), '{}'::jsonb)
  );

  if v_attempt.status = 'completed' then
    -- Show exactly what was submitted (snapshotted text).
    v_result := v_result || jsonb_build_object('categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', null, 'name', cat.category_name, 'description', null,
                                          'questions', cat.questions) order by cat.first_order)
      from (
        select a.category_name, min(coalesce(c.sort_order, 0)) as first_order,
               jsonb_agg(jsonb_build_object('id', a.question_id, 'title', a.question_title,
                                            'content', a.question_text, 'is_required', true)
                         order by coalesce(q.sort_order, 0), a.question_title) as questions
        from public.evaluation_answers a
        left join public.questions q on q.id = a.question_id
        left join public.question_categories c on c.id = a.category_id
        where a.attempt_id = v_attempt.id
        group by a.category_name
      ) cat), '[]'::jsonb));
  else
    v_result := v_result || jsonb_build_object('categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'description', c.description,
                                          'questions', qs.questions) order by c.sort_order, c.name)
      from public.question_categories c
      join lateral (
        select jsonb_agg(jsonb_build_object('id', q.id, 'title', q.title, 'content', q.content,
                                            'is_required', q.is_required)
                         order by q.sort_order, q.title) as questions
        from public.questions q where q.category_id = c.id and q.is_active
      ) qs on qs.questions is not null
      where c.is_active), '[]'::jsonb));
  end if;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Internal: validate + upsert an in-progress attempt. Returns the attempt id.
-- -----------------------------------------------------------------------------
create or replace function public._save_evaluation(p_offering_id uuid, p_answers jsonb, p_comment text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_student   uuid := public.current_student_id();
  v_period    public.academic_periods;
  v_attempt   public.evaluation_attempts;
  v_scale     jsonb := coalesce(public.get_setting('rating_scale'), '[]'::jsonb);
  v_scale_max int;
  v_bad       int;
  v_comment   text := nullif(trim(coalesce(p_comment, '')), '');
begin
  if v_student is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select ap.* into v_period
  from public.subject_offerings o
  join public.academic_periods ap on ap.id = o.academic_period_id
  where o.id = p_offering_id and o.deleted_at is null;
  if v_period.id is null then
    raise exception 'Evaluation not found' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.subject_enrollments e
                 where e.offering_id = p_offering_id and e.student_id = v_student) then
    raise exception 'You are not enrolled in this subject' using errcode = '42501';
  end if;
  if now() < v_period.open_at then
    raise exception 'The evaluation period has not opened yet' using errcode = 'P0001';
  end if;
  if now() > v_period.close_at then
    raise exception 'The evaluation period is already closed' using errcode = 'P0001';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Invalid answers payload' using errcode = '22023';
  end if;
  if v_comment is not null and length(v_comment) > 3000 then
    raise exception 'Comment is too long (maximum 3000 characters)' using errcode = '22001';
  end if;

  select max((x ->> 'value')::int) into v_scale_max from jsonb_array_elements(v_scale) x;
  v_scale_max := coalesce(v_scale_max, 5);

  -- Every key must be an active question and every value an integer in range.
  select count(*) into v_bad
  from jsonb_each(p_answers) j
  where j.key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or jsonb_typeof(j.value) <> 'number'
     or (j.value)::text !~ '^[0-9]+$'
     or (j.value)::text::int not between 1 and v_scale_max
     or not exists (select 1 from public.questions q
                    join public.question_categories c on c.id = q.category_id
                    where q.id = j.key::uuid and q.is_active and c.is_active);
  if v_bad > 0 then
    raise exception 'One or more answers are invalid' using errcode = '22023';
  end if;

  insert into public.evaluation_attempts (offering_id, student_id, academic_period_id)
  values (p_offering_id, v_student, v_period.id)
  on conflict (student_id, offering_id, academic_period_id) do nothing;

  select * into v_attempt from public.evaluation_attempts a
  where a.offering_id = p_offering_id and a.student_id = v_student
  for update;

  if v_attempt.status = 'completed' then
    raise exception 'You have already submitted this evaluation' using errcode = 'P0001';
  end if;

  insert into public.evaluation_answers
    (attempt_id, question_id, category_id, rating, scale_max, rating_label,
     category_name, question_title, question_text)
  select v_attempt.id, q.id, c.id, (j.value)::text::smallint, v_scale_max,
         (select x ->> 'label' from jsonb_array_elements(v_scale) x
           where (x ->> 'value')::int = (j.value)::text::int limit 1),
         c.name, q.title, q.content
  from jsonb_each(p_answers) j
  join public.questions q on q.id = j.key::uuid
  join public.question_categories c on c.id = q.category_id
  on conflict (attempt_id, question_id) do update
    set rating = excluded.rating, scale_max = excluded.scale_max, rating_label = excluded.rating_label,
        category_id = excluded.category_id, category_name = excluded.category_name,
        question_title = excluded.question_title, question_text = excluded.question_text;

  if v_comment is null then
    delete from public.evaluation_comments where attempt_id = v_attempt.id;
  else
    insert into public.evaluation_comments (attempt_id, comment) values (v_attempt.id, v_comment)
    on conflict (attempt_id) do update set comment = excluded.comment;
  end if;

  update public.evaluation_attempts set updated_at = now() where id = v_attempt.id;
  return v_attempt.id;
end;
$$;

create or replace function public.save_evaluation_progress(p_offering_id uuid, p_answers jsonb, p_comment text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_attempt uuid;
begin
  v_attempt := public._save_evaluation(p_offering_id, p_answers, p_comment);
  return jsonb_build_object('attempt_id', v_attempt, 'status', 'in_progress', 'saved_at', now());
end;
$$;

create or replace function public.submit_evaluation(p_offering_id uuid, p_answers jsonb, p_comment text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_attempt uuid;
  v_missing int;
  v_avg     numeric;
begin
  v_attempt := public._save_evaluation(p_offering_id, p_answers, p_comment);

  select count(*) into v_missing
  from public.questions q
  join public.question_categories c on c.id = q.category_id
  where q.is_active and c.is_active and q.is_required
    and not exists (select 1 from public.evaluation_answers a
                    where a.attempt_id = v_attempt and a.question_id = q.id);
  if v_missing > 0 then
    raise exception 'Please answer all required questions (% remaining)', v_missing using errcode = 'P0001';
  end if;

  if coalesce((public.get_setting('require_comments'))::text::boolean, false)
     and not exists (select 1 from public.evaluation_comments where attempt_id = v_attempt) then
    raise exception 'Please provide your comments or suggestions for the instructor' using errcode = 'P0001';
  end if;

  -- Only questions active at submission time form part of the evaluation;
  -- refresh the snapshot so it reflects the exact text that was submitted.
  delete from public.evaluation_answers a
  using public.questions q, public.question_categories c
  where a.attempt_id = v_attempt and q.id = a.question_id and c.id = q.category_id
    and (not q.is_active or not c.is_active);

  update public.evaluation_answers a
     set category_id = c.id, category_name = c.name, question_title = q.title, question_text = q.content
    from public.questions q
    join public.question_categories c on c.id = q.category_id
   where a.attempt_id = v_attempt and q.id = a.question_id;

  select avg(rating) into v_avg from public.evaluation_answers where attempt_id = v_attempt;
  if v_avg is null then
    raise exception 'Your evaluation has no answers' using errcode = 'P0001';
  end if;

  update public.evaluation_attempts
     set status = 'completed', submitted_at = now(), average_rating = round(v_avg, 3)
   where id = v_attempt;

  return jsonb_build_object('attempt_id', v_attempt, 'status', 'completed', 'submitted_at', now(),
                            'average_rating', round(v_avg, 3));
end;
$$;

-- -----------------------------------------------------------------------------
-- Results visibility for faculty
-- -----------------------------------------------------------------------------
create or replace function public.results_visible(p_period_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select case coalesce(public.get_setting('results_visibility') #>> '{}', 'after_close')
           when 'immediate' then true
           when 'manual' then ap.results_released_at is not null
           else now() > ap.close_at or ap.results_released_at is not null
         end
  from public.academic_periods ap where ap.id = p_period_id
$$;

create or replace function public.min_respondents()
returns int
language sql stable security definer
set search_path = ''
as $$
  select greatest(1, coalesce((public.get_setting('min_respondents') #>> '{}')::int, 3))
$$;

-- Faculty: their offerings with progress and (when permitted) averages.
-- Never returns student identifiers.
create or replace function public.get_faculty_offerings(p_period_id uuid default null)
returns table (
  offering_id uuid, subject_code text, subject_title text, section text, program_code text,
  period_id uuid, period_label text, school_year text, semester smallint, is_current boolean,
  enrolled int, completed int, results_visible boolean, meets_threshold boolean, average numeric
)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_faculty uuid := public.current_faculty_id();
  v_min     int := public.min_respondents();
begin
  if v_faculty is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
  select o.id, s.code, s.title, o.section, p.code,
         ap.id, ap.label, ap.school_year, ap.semester, ap.is_current,
         st.enrolled, st.completed,
         public.results_visible(ap.id), st.completed >= v_min,
         case when public.results_visible(ap.id) and st.completed >= v_min then round(st.avg_rating, 2) end
  from public.subject_offerings o
  join public.subjects s on s.id = o.subject_id
  join public.programs p on p.id = o.program_id
  join public.academic_periods ap on ap.id = o.academic_period_id
  cross join lateral (
    select (select count(*) from public.subject_enrollments e where e.offering_id = o.id)::int as enrolled,
           (select count(*) from public.evaluation_attempts a where a.offering_id = o.id and a.status = 'completed')::int as completed,
           (select avg(ans.rating) from public.evaluation_answers ans
              join public.evaluation_attempts a on a.id = ans.attempt_id
             where a.offering_id = o.id and a.status = 'completed') as avg_rating
  ) st
  where o.faculty_id = v_faculty and o.deleted_at is null
    and (p_period_id is null or o.academic_period_id = p_period_id)
  order by ap.start_year desc, ap.semester desc, s.code;
end;
$$;

-- Faculty (own offering) or admin: aggregate results for one offering.
-- Comments are returned without identities or timestamps, in a stable
-- pseudo-random order so they cannot be matched to submission order.
create or replace function public.get_offering_results(p_offering_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_is_admin boolean := public.is_admin();
  v_faculty  uuid := public.current_faculty_id();
  v_off      record;
  v_min      int := public.min_respondents();
  v_resp     int;
  v_enrolled int;
  v_visible  boolean;
begin
  select o.id, o.faculty_id, o.academic_period_id, s.code as subject_code, s.title as subject_title, o.section,
         ap.label as period_label, ap.school_year, ap.semester, p.code as program_code,
         public.format_person_name(f.first_name, f.middle_name, f.last_name) as faculty_name
    into v_off
  from public.subject_offerings o
  join public.subjects s on s.id = o.subject_id
  join public.academic_periods ap on ap.id = o.academic_period_id
  join public.programs p on p.id = o.program_id
  join public.faculty f on f.id = o.faculty_id
  where o.id = p_offering_id and o.deleted_at is null;

  if v_off.id is null or not (v_is_admin or (v_faculty is not null and v_off.faculty_id = v_faculty)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select count(*) into v_resp from public.evaluation_attempts a
   where a.offering_id = p_offering_id and a.status = 'completed';
  select count(*) into v_enrolled from public.subject_enrollments e where e.offering_id = p_offering_id;
  v_visible := v_is_admin or public.results_visible(v_off.academic_period_id);

  if not v_visible or (not v_is_admin and v_resp < v_min) then
    return jsonb_build_object(
      'offering', to_jsonb(v_off) - 'faculty_id' - 'academic_period_id',
      'visible', false,
      'reason', case when not v_visible then 'not_released' else 'insufficient_respondents' end,
      'respondents', v_resp, 'enrolled', v_enrolled, 'min_respondents', v_min);
  end if;

  return jsonb_build_object(
    'offering', to_jsonb(v_off) - 'faculty_id' - 'academic_period_id',
    'visible', true,
    'respondents', v_resp, 'enrolled', v_enrolled, 'min_respondents', v_min,
    'overall_average', (select round(avg(ans.rating), 2) from public.evaluation_answers ans
                         join public.evaluation_attempts a on a.id = ans.attempt_id
                        where a.offering_id = p_offering_id and a.status = 'completed'),
    'categories', coalesce((select jsonb_agg(x order by x.average desc) from (
        select ans.category_name as name, round(avg(ans.rating), 2) as average, count(*)::int as responses
        from public.evaluation_answers ans
        join public.evaluation_attempts a on a.id = ans.attempt_id
        where a.offering_id = p_offering_id and a.status = 'completed'
        group by ans.category_name) x), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(x order by x.category, x.sort_order, x.title) from (
        select ans.category_name as category, ans.question_title as title, ans.question_text as content,
               min(coalesce(q.sort_order, 0)) as sort_order,
               round(avg(ans.rating), 2) as average, count(*)::int as responses
        from public.evaluation_answers ans
        join public.evaluation_attempts a on a.id = ans.attempt_id
        left join public.questions q on q.id = ans.question_id
        where a.offering_id = p_offering_id and a.status = 'completed'
        group by ans.category_name, ans.question_title, ans.question_text) x), '[]'::jsonb),
    'distribution', coalesce((select jsonb_agg(x order by x.rating) from (
        select ans.rating, count(*)::int as count
        from public.evaluation_answers ans
        join public.evaluation_attempts a on a.id = ans.attempt_id
        where a.offering_id = p_offering_id and a.status = 'completed'
        group by ans.rating) x), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(c.comment order by md5(c.id::text))
        from public.evaluation_comments c
        join public.evaluation_attempts a on a.id = c.attempt_id
        where a.offering_id = p_offering_id and a.status = 'completed'), '[]'::jsonb)
  );
end;
$$;

-- Faculty dashboard analytics — only offerings whose results are visible and
-- meet the minimum-respondent threshold contribute to rating figures.
create or replace function public.get_faculty_analytics(p_period_id uuid default null, p_offering_id uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_faculty uuid := public.current_faculty_id();
  v_min     int := public.min_respondents();
  v_result  jsonb;
begin
  if v_faculty is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  with offs as (
    select o.id, o.subject_id, o.academic_period_id, ap.label, ap.start_year, ap.semester, ap.school_year,
           public.results_visible(ap.id) as visible,
           (select count(*) from public.evaluation_attempts a where a.offering_id = o.id and a.status = 'completed') as completed,
           (select count(*) from public.subject_enrollments e where e.offering_id = o.id) as enrolled
    from public.subject_offerings o
    join public.academic_periods ap on ap.id = o.academic_period_id
    where o.faculty_id = v_faculty and o.deleted_at is null
  ),
  released as (select * from offs where visible and completed >= v_min),
  scoped as (
    select * from released
    where (p_period_id is null or academic_period_id = p_period_id)
      and (p_offering_id is null or id = p_offering_id)
  ),
  -- History ignores the period filter; with a subject filter it follows the same subject.
  hist_ans as (
    select r.label, r.start_year, r.semester, r.school_year, x.rating, x.attempt_id
    from released r
    join public.evaluation_attempts a on a.offering_id = r.id and a.status = 'completed'
    join public.evaluation_answers x on x.attempt_id = a.id
    where p_offering_id is null
       or r.subject_id = (select o2.subject_id from public.subject_offerings o2 where o2.id = p_offering_id)
  ),
  ans as (
    select ans.rating, ans.category_name, a.offering_id
    from public.evaluation_answers ans
    join public.evaluation_attempts a on a.id = ans.attempt_id and a.status = 'completed'
    where a.offering_id in (select id from scoped)
  )
  select jsonb_build_object(
    'min_respondents', v_min,
    'progress', (select jsonb_build_object('offerings', count(*), 'enrolled', coalesce(sum(enrolled), 0),
                                           'completed', coalesce(sum(completed), 0))
                 from offs where (p_period_id is null or academic_period_id = p_period_id)
                             and (p_offering_id is null or id = p_offering_id)),
    'released_offerings', (select count(*) from scoped),
    'respondents', (select coalesce(sum(completed), 0) from scoped),
    'overall_average', (select round(avg(rating), 2) from ans),
    'categories', coalesce((select jsonb_agg(x order by x.average desc) from (
        select category_name as name, round(avg(rating), 2) as average, count(*)::int as responses
        from ans group by category_name) x), '[]'::jsonb),
    'distribution', coalesce((select jsonb_agg(x order by x.rating) from (
        select rating, count(*)::int as count from ans group by rating) x), '[]'::jsonb),
    'comment_count', (select count(*) from public.evaluation_comments c
                      join public.evaluation_attempts a on a.id = c.attempt_id and a.status = 'completed'
                      where a.offering_id in (select id from scoped)),
    'history', coalesce((select jsonb_agg(x order by x.start_year, x.semester) from (
        select label, start_year, semester, school_year,
               round(avg(rating), 2) as average, count(distinct attempt_id)::int as respondents
        from hist_ans group by label, start_year, semester, school_year) x), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;
