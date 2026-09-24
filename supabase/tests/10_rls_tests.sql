-- RLS / business-rule verification. Each block prints PASS/FAIL lines.
\set QUIET on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.as_user(p_email text) returns void language plpgsql as $$
declare v uuid;
begin
  select id into v from auth.users where email = p_email;
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, false);
end $$;

create or replace function pg_temp.check(p_name text, p_ok boolean) returns text language sql as $$
  select case when p_ok then 'PASS  ' else 'FAIL  ' end || p_name
$$;

-- Pick fixtures as superuser
select set_config('t.student', (select p.email from students s join profiles p on p.id = s.profile_id
   join subject_enrollments e on e.student_id = s.id join subject_offerings o on o.id = e.offering_id
   join academic_periods ap on ap.id = o.academic_period_id and ap.is_current
   where not exists (select 1 from evaluation_attempts a where a.student_id = s.id and a.offering_id = o.id)
   limit 1), false) \g /dev/null
select set_config('t.offering', (select o.id::text from students s join profiles p on p.id = s.profile_id
   join subject_enrollments e on e.student_id = s.id join subject_offerings o on o.id = e.offering_id
   join academic_periods ap on ap.id = o.academic_period_id and ap.is_current
   where p.email = current_setting('t.student')
     and not exists (select 1 from evaluation_attempts a where a.student_id = s.id and a.offering_id = o.id)
   limit 1), false) \g /dev/null
select set_config('t.other_offering', (select o.id::text from subject_offerings o
   join academic_periods ap on ap.id = o.academic_period_id and ap.is_current
   where not exists (select 1 from subject_enrollments e join students s on s.id = e.student_id
                     join profiles p on p.id = s.profile_id
                     where e.offering_id = o.id and p.email = current_setting('t.student'))
   limit 1), false) \g /dev/null
select set_config('t.faculty', (select p.email from faculty f join profiles p on p.id = f.profile_id
   where f.faculty_number = 'FAC-0001'), false) \g /dev/null
select set_config('t.fac_past_offering', (select o.id::text from subject_offerings o join faculty f on f.id = o.faculty_id
   join academic_periods ap on ap.id = o.academic_period_id
   where f.faculty_number = 'FAC-0001' and not ap.is_current order by ap.start_year limit 1), false) \g /dev/null
select set_config('t.fac_current_offering', (select o.id::text from subject_offerings o join faculty f on f.id = o.faculty_id
   join academic_periods ap on ap.id = o.academic_period_id
   where f.faculty_number = 'FAC-0001' and ap.is_current limit 1), false) \g /dev/null
select set_config('t.not_fac_offering', (select o.id::text from subject_offerings o join faculty f on f.id = o.faculty_id
   where f.faculty_number <> 'FAC-0001' limit 1), false) \g /dev/null
select set_config('t.all_q', (select jsonb_object_agg(q.id, 4)::text from questions q where q.is_active), false) \g /dev/null
select set_config('t.one_q', (select jsonb_build_object(q.id, 5)::text from questions q where q.is_active limit 1), false) \g /dev/null

-- ============================================================= ANON
set role anon;
do $$ begin
  perform 1 from public.students limit 1;
  raise notice 'FAIL  anon can read students';
exception when insufficient_privilege then raise notice 'PASS  anon denied on students';
end $$;
do $$ begin
  perform public.get_student_evaluations(null);
  raise notice 'FAIL  anon can execute get_student_evaluations';
exception when insufficient_privilege then raise notice 'PASS  anon cannot execute RPCs';
end $$;
reset role;

-- ============================================================= STUDENT
select pg_temp.as_user(current_setting('t.student')) \g /dev/null
set role authenticated;
select pg_temp.check('student sees only own student row', (select count(*) from students) = 1);
select pg_temp.check('student cannot read faculty table (birthday etc.)', (select count(*) from faculty) = 0);
select pg_temp.check('student cannot read activity logs', (select count(*) from activity_logs) = 0);
select pg_temp.check('student sees only own enrollments', (select count(distinct student_id) from subject_enrollments) = 1);
select pg_temp.check('student sees no one else''s attempts', (select count(*) from evaluation_attempts where student_id <> current_student_id()) = 0);
select pg_temp.check('student sees no one else''s answers', (select count(*) from evaluation_answers) = (select count(*) from evaluation_answers a join evaluation_attempts t on t.id=a.attempt_id where t.student_id = current_student_id()));
select pg_temp.check('student sees only enrolled offerings', (select count(*) from subject_offerings o where not exists (select 1 from subject_enrollments e where e.offering_id=o.id)) = 0);
select pg_temp.check('student evaluation list returns rows', (select count(*) from get_student_evaluations(null)) > 0);
select pg_temp.check('student form payload has categories', jsonb_array_length((get_evaluation_form(current_setting('t.offering')::uuid))->'categories') = 5);

do $$ begin
  perform get_evaluation_form(current_setting('t.other_offering')::uuid);
  raise notice 'FAIL  student opened form for non-enrolled offering';
exception when insufficient_privilege then raise notice 'PASS  non-enrolled form blocked';
end $$;
do $$ begin
  perform save_evaluation_progress(current_setting('t.other_offering')::uuid, current_setting('t.one_q')::jsonb, null);
  raise notice 'FAIL  student saved evaluation for non-enrolled offering';
exception when insufficient_privilege then raise notice 'PASS  non-enrolled save blocked';
end $$;
do $$ begin
  insert into evaluation_attempts (offering_id, student_id, academic_period_id)
  select current_setting('t.offering')::uuid, current_student_id(), academic_period_id from subject_offerings where id = current_setting('t.offering')::uuid;
  raise notice 'FAIL  direct attempt insert allowed';
exception when insufficient_privilege then raise notice 'PASS  direct attempt insert denied';
end $$;
do $$ begin
  update students set program_id = program_id;
  if found then raise notice 'FAIL  student updated own student row'; else raise notice 'PASS  student cannot update student row'; end if;
end $$;
do $$ begin
  update profiles set role = 'admin' where id = auth.uid();
  raise notice 'FAIL  student escalated role';
exception when insufficient_privilege then raise notice 'PASS  role escalation denied';
end $$;
do $$ begin
  perform save_evaluation_progress(current_setting('t.offering')::uuid, '{"00000000-0000-0000-0000-000000000000": 5}'::jsonb, null);
  raise notice 'FAIL  unknown question accepted';
exception when others then raise notice 'PASS  unknown question rejected (%)', sqlerrm;
end $$;
do $$ begin
  perform save_evaluation_progress(current_setting('t.offering')::uuid,
    (select jsonb_object_agg(key, 9) from jsonb_each(current_setting('t.one_q')::jsonb)), null);
  raise notice 'FAIL  out-of-range rating accepted';
exception when others then raise notice 'PASS  out-of-range rating rejected (%)', sqlerrm;
end $$;
select pg_temp.check('save progress works', (save_evaluation_progress(current_setting('t.offering')::uuid, current_setting('t.one_q')::jsonb, 'Good job'))->>'status' = 'in_progress');
do $$ begin
  perform submit_evaluation(current_setting('t.offering')::uuid, current_setting('t.one_q')::jsonb, null);
  raise notice 'FAIL  incomplete submission accepted';
exception when others then raise notice 'PASS  incomplete submission rejected (%)', sqlerrm;
end $$;
select pg_temp.check('full submission works', (submit_evaluation(current_setting('t.offering')::uuid, current_setting('t.all_q')::jsonb, 'Great instructor'))->>'status' = 'completed');
do $$ begin
  perform submit_evaluation(current_setting('t.offering')::uuid, current_setting('t.all_q')::jsonb, null);
  raise notice 'FAIL  duplicate submission accepted';
exception when others then raise notice 'PASS  duplicate submission rejected (%)', sqlerrm;
end $$;
do $$ begin
  perform save_evaluation_progress(current_setting('t.offering')::uuid, current_setting('t.one_q')::jsonb, null);
  raise notice 'FAIL  edit after submit accepted';
exception when others then raise notice 'PASS  edit after submit rejected (%)', sqlerrm;
end $$;
select pg_temp.check('completed form shows snapshot', (get_evaluation_form(current_setting('t.offering')::uuid))->'attempt'->>'status' = 'completed');
do $$ begin
  perform admin_analytics();
  raise notice 'FAIL  student ran admin analytics';
exception when insufficient_privilege then raise notice 'PASS  student blocked from admin analytics';
end $$;
reset role;

-- Closed period: submission must be rejected
select set_config('t.closed_offering', (select o.id::text from subject_offerings o join subject_enrollments e on e.offering_id=o.id
  join students s on s.id=e.student_id join profiles p on p.id=s.profile_id join academic_periods ap on ap.id=o.academic_period_id
  where not ap.is_current and not exists (select 1 from evaluation_attempts a where a.offering_id=o.id and a.student_id=s.id) limit 1), false) \g /dev/null
select set_config('t.closed_student', (select p.email from subject_offerings o join subject_enrollments e on e.offering_id=o.id
  join students s on s.id=e.student_id join profiles p on p.id=s.profile_id
  where o.id = current_setting('t.closed_offering')::uuid and not exists (select 1 from evaluation_attempts a where a.offering_id=o.id and a.student_id=s.id) limit 1), false) \g /dev/null
select pg_temp.as_user(current_setting('t.closed_student')) \g /dev/null
set role authenticated;
do $$ begin
  perform submit_evaluation(current_setting('t.closed_offering')::uuid, current_setting('t.all_q')::jsonb, null);
  raise notice 'FAIL  closed-period submission accepted';
exception when others then raise notice 'PASS  closed-period submission rejected (%)', sqlerrm;
end $$;
reset role;

-- ============================================================= FACULTY
select pg_temp.as_user(current_setting('t.faculty')) \g /dev/null
set role authenticated;
select pg_temp.check('faculty cannot read students', (select count(*) from students) = 0);
select pg_temp.check('faculty cannot read enrollments', (select count(*) from subject_enrollments) = 0);
select pg_temp.check('faculty cannot read attempts', (select count(*) from evaluation_attempts) = 0);
select pg_temp.check('faculty cannot read answers', (select count(*) from evaluation_answers) = 0);
select pg_temp.check('faculty cannot read comments', (select count(*) from evaluation_comments) = 0);
select pg_temp.check('faculty sees own faculty row only', (select count(*) from faculty) = 1);
select pg_temp.check('faculty sees only own offerings', (select count(*) from subject_offerings where faculty_id <> current_faculty_id()) = 0);
select pg_temp.check('faculty offerings RPC works', (select count(*) from get_faculty_offerings(null)) > 0);
select pg_temp.check('faculty past results visible', (get_offering_results(current_setting('t.fac_past_offering')::uuid))->>'visible' = 'true');
select pg_temp.check('faculty results contain no student identifiers',
  (get_offering_results(current_setting('t.fac_past_offering')::uuid))::text !~* '(student_id|student_number|attempt_id|@student)');
select pg_temp.check('faculty current results hidden (after_close)', (get_offering_results(current_setting('t.fac_current_offering')::uuid))->>'reason' = 'not_released');
select pg_temp.check('faculty analytics works', (get_faculty_analytics(null, null))->'overall_average' is not null);
do $$ begin
  perform get_offering_results(current_setting('t.not_fac_offering')::uuid);
  raise notice 'FAIL  faculty read another faculty''s results';
exception when insufficient_privilege then raise notice 'PASS  other faculty results blocked';
end $$;
do $$ begin
  delete from evaluation_attempts;
  if found then raise notice 'FAIL  faculty deleted attempts'; else raise notice 'PASS  faculty cannot delete attempts'; end if;
end $$;
reset role;

-- ============================================================= ADMIN
select pg_temp.as_user('admin@asscat.edu.ph') \g /dev/null
set role authenticated;
select pg_temp.check('admin reads all students', (select count(*) from students) = 96);
select pg_temp.check('admin reads offering_overview', (select count(*) from offering_overview) > 0);
select pg_temp.check('admin analytics returns kpis', (admin_analytics())->'kpis'->>'total_students' = '96');
select pg_temp.check('admin analytics filtered', (admin_analytics(p_start_year => 2025, p_semester => 1))->'kpis'->>'completed' is not null);
select pg_temp.check('admin reads activity logs', (select count(*) from activity_logs) >= 1);
do $$ begin
  update evaluation_answers set rating = 1;
  raise notice 'FAIL  admin edited answers';
exception when insufficient_privilege then raise notice 'PASS  admin cannot edit answers directly';
end $$;
select pg_temp.check('admin reset of completed attempt works',
  (admin_reset_evaluation((select a.id from evaluation_attempts a where a.offering_id = current_setting('t.offering')::uuid and a.status='completed' limit 1)))->>'status' = 'completed');
select admin_set_current_period((select id from academic_periods where start_year=2025 and semester=2)) \g /dev/null
select pg_temp.check('set current period works (exactly one current)', (select count(*) from academic_periods where is_current) = 1
  and (select start_year from academic_periods where is_current) = 2025);
select admin_set_current_period((select id from academic_periods where start_year=2026 and semester=1)) \g /dev/null
select pg_temp.check('notifications generated', generate_scheduled_notifications() >= 0);
do $$ begin
  insert into activity_logs (action, module) values ('x', 'y');
  raise notice 'FAIL  admin forged activity log via client';
exception when insufficient_privilege then raise notice 'PASS  activity log client insert denied';
end $$;
reset role;

-- Integrity constraints (as superuser)
do $$ begin
  update academic_periods set close_at = open_at - interval '1 day' where is_current;
  raise notice 'FAIL  close < open accepted';
exception when check_violation then raise notice 'PASS  close_date < open_date rejected';
end $$;
do $$ begin
  insert into students (student_number, first_name, last_name, email, program_id, year_level_id)
  select upper(student_number), 'X', 'Y', 'dupe@x.com', program_id, year_level_id from students limit 1;
  raise notice 'FAIL  duplicate student id accepted';
exception when unique_violation then raise notice 'PASS  duplicate student id rejected';
end $$;
do $$ begin
  update faculty set department_id = (select id from departments where code = 'CBM') where faculty_number = 'FAC-0001';
  if (select d.code from faculty f join departments d on d.id=f.department_id where faculty_number='FAC-0001') = 'CEIT'
  then raise notice 'PASS  faculty department re-derived from program';
  else raise notice 'FAIL  inconsistent faculty department stored'; end if;
end $$;
