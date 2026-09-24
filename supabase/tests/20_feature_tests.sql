\set QUIET on
\pset tuples_only on
\pset format unaligned
create or replace function pg_temp.as_user(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated')::text, false);
end $$;
create or replace function pg_temp.check(p_name text, p_ok boolean) returns text language sql as $$
  select case when p_ok then 'PASS  ' else 'FAIL  ' end || p_name $$;

select pg_temp.as_user('admin@asscat.edu.ph') \g /dev/null
set role authenticated;

-- ---------------------------------------------------------------- analytics consistency
select pg_temp.check('analytics completed == direct count (current period)',
  ((admin_analytics(p_period_id => (select id from academic_periods where is_current)))->'kpis'->>'completed')::int
  = (select count(*) from evaluation_attempts a join subject_offerings o on o.id = a.offering_id
     where a.status = 'completed' and o.deleted_at is null and o.academic_period_id = (select id from academic_periods where is_current)));
select pg_temp.check('analytics expected == enrollments (current period)',
  ((admin_analytics(p_period_id => (select id from academic_periods where is_current)))->'kpis'->>'expected')::int
  = (select count(*) from subject_enrollments e join subject_offerings o on o.id = e.offering_id
     where o.deleted_at is null and o.academic_period_id = (select id from academic_periods where is_current)));
select pg_temp.check('analytics avg == avg of answers (2025 1st sem)',
  ((admin_analytics(p_start_year => 2025, p_semester => 1))->'kpis'->>'average_rating')::numeric
  = (select round(avg(x.rating), 2) from evaluation_answers x join evaluation_attempts a on a.id = x.attempt_id and a.status = 'completed'
     join subject_offerings o on o.id = a.offering_id join academic_periods ap on ap.id = o.academic_period_id
     where o.deleted_at is null and ap.start_year = 2025 and ap.semester = 1));
select pg_temp.check('top faculty respect min respondents',
  not exists (select 1 from jsonb_array_elements((admin_analytics())->'top_faculty') t where (t->>'respondents')::int < min_respondents()));
select pg_temp.check('age & service buckets populated', jsonb_array_length((admin_analytics())->'age_ranges') > 0 and jsonb_array_length((admin_analytics())->'service_ranges') > 0);
select pg_temp.check('department filter narrows scope',
  ((admin_analytics(p_department_id => (select id from departments where code='CEIT')))->'kpis'->>'expected')::int
  < ((admin_analytics())->'kpis'->>'expected')::int);
select pg_temp.check('rating_by_period covers 5 semesters', jsonb_array_length((admin_analytics())->'rating_by_period') = 5);

-- ---------------------------------------------------------------- historical integrity
select set_config('t.q', (select id::text from questions where title = 'TC-1'), false) \g /dev/null
select set_config('t.before', (select count(*)::text from evaluation_answers where question_text = 'Demonstrates mastery of the subject matter.'), false) \g /dev/null
update questions set content = 'EDITED question text' where id = current_setting('t.q')::uuid;
select pg_temp.check('editing a question does not change historical answers',
  (select count(*) from evaluation_answers where question_text = 'Demonstrates mastery of the subject matter.')::text = current_setting('t.before')
  and not exists (select 1 from evaluation_answers a join evaluation_attempts t on t.id = a.attempt_id where t.status = 'completed' and a.question_text = 'EDITED question text'));
update questions set content = 'Demonstrates mastery of the subject matter.' where id = current_setting('t.q')::uuid;
do $$ begin
  delete from questions where id = current_setting('t.q')::uuid;
  raise notice 'FAIL  used question was deleted';
exception when foreign_key_violation then raise notice 'PASS  used question cannot be deleted (deactivate instead)';
end $$;

-- ---------------------------------------------------------------- course import
select pg_temp.check('course import creates subject/class/enrollments',
  (select (r->>'subjects_created')::int = 1 and (r->>'offerings_created')::int = 1 and (r->>'enrollments_created')::int = 2
   from (select admin_import_course_rows(jsonb_build_array(
     jsonb_build_object('subject_code','IT 999','subject_title','Capstone','faculty_number','FAC-0001','program_code','BSIT',
                        'student_number',(select student_number from students s join programs p on p.id=s.program_id where p.code='BSIT' order by 1 limit 1),
                        'start_year',2026,'semester',1,'section','Z'),
     jsonb_build_object('subject_code','IT 999','subject_title','Capstone','faculty_number','FAC-0001','program_code','BSIT',
                        'student_number',(select student_number from students s join programs p on p.id=s.program_id where p.code='BSIT' order by 1 offset 1 limit 1),
                        'start_year',2026,'semester',1,'section','Z'))) r) x));
select pg_temp.check('re-import is idempotent (enrollments_existing)',
  (select (r->>'enrollments_existing')::int = 1 and (r->>'offerings_created')::int = 0
   from (select admin_import_course_rows(jsonb_build_array(
     jsonb_build_object('subject_code','it 999','subject_title','Capstone','faculty_number','fac-0001','program_code','bsit',
                        'student_number',(select student_number from students s join programs p on p.id=s.program_id where p.code='BSIT' order by 1 limit 1),
                        'start_year',2026,'semester',1,'section','z'))) r) x));
select set_config('t.subjects_before', (select count(*)::text from subjects), false) \g /dev/null
do $$ begin
  perform admin_import_course_rows(jsonb_build_array(
    jsonb_build_object('subject_code','NEW 1','subject_title','New','faculty_number','FAC-0001','program_code','BSIT','student_number','2026-0001','start_year',2026,'semester',1,'section',''),
    jsonb_build_object('subject_code','NEW 2','subject_title','New','faculty_number','FAC-9999','program_code','BSIT','student_number','2026-0001','start_year',2026,'semester',1,'section','')));
  raise notice 'FAIL  import with unknown faculty succeeded';
exception when foreign_key_violation then raise notice 'PASS  bad row aborts import (%)', sqlerrm;
end $$;
select pg_temp.check('failed import rolled back atomically', (select count(*)::text from subjects) = current_setting('t.subjects_before'));

-- ---------------------------------------------------------------- evaluation import
select set_config('t.off', (select o.id::text from subject_offerings o join subjects s on s.id=o.subject_id where s.code='IT 999'), false) \g /dev/null
select set_config('t.stu', (select s.student_number from subject_enrollments e join students s on s.id=e.student_id where e.offering_id = current_setting('t.off')::uuid order by 1 limit 1), false) \g /dev/null
select pg_temp.check('evaluation import creates completed attempt with snapshot',
  (select (r->>'evaluations_created')::int = 1
   from (select admin_import_evaluation_rows((select jsonb_agg(jsonb_build_object('student_number', current_setting('t.stu'), 'subject_code','IT 999',
      'faculty_number','FAC-0001','start_year',2026,'semester',1,'section','Z','question_id', q.id, 'rating', 4, 'comment','Imported comment',
      'submitted_at','2026-09-20T10:00:00+08:00')) from questions q where q.is_active)) r) x));
select pg_temp.check('imported attempt is completed, source=import, average=4',
  exists (select 1 from evaluation_attempts a join students s on s.id=a.student_id where s.student_number = current_setting('t.stu')
              and a.offering_id = current_setting('t.off')::uuid and a.status='completed' and a.source='import' and a.average_rating = 4));
select pg_temp.check('evaluation re-import preserves existing (skipped)',
  (select (r->>'evaluations_skipped')::int = 1 and (r->>'evaluations_created')::int = 0
   from (select admin_import_evaluation_rows((select jsonb_agg(jsonb_build_object('student_number', current_setting('t.stu'), 'subject_code','IT 999',
      'faculty_number','FAC-0001','start_year',2026,'semester',1,'section','Z','question_id', q.id, 'rating', 1)) from questions q where q.is_active)) r) x)
  and (select average_rating from evaluation_attempts a join students s on s.id=a.student_id where s.student_number = current_setting('t.stu') and a.offering_id = current_setting('t.off')::uuid) = 4);
do $$ begin
  perform admin_import_evaluation_rows(jsonb_build_array(jsonb_build_object('student_number','2026-0001','subject_code','IT 999','faculty_number','FAC-0001','start_year',2026,'semester',1,'section','Z','question_id',(select id from questions limit 1),'rating',9)));
  raise notice 'FAIL  out-of-scale imported rating accepted';
exception when others then raise notice 'PASS  out-of-scale imported rating rejected (%)', sqlerrm;
end $$;

-- ---------------------------------------------------------------- release + notifications
update system_settings set value = '"manual"' where key = 'results_visibility';
select admin_release_results((select id from academic_periods where is_current), true) \g /dev/null
reset role;
select pg_temp.check('manual release notifies faculty',
  (select count(*) from notifications where dedupe_key = 'results-released:' || (select id from academic_periods where is_current)) > 0);
set role authenticated;
select admin_release_results((select id from academic_periods where is_current), false) \g /dev/null
update system_settings set value = '"after_close"' where key = 'results_visibility';
select pg_temp.check('scheduled notifications are idempotent', generate_scheduled_notifications() >= 0 and generate_scheduled_notifications() = 0);
reset role;

-- ---------------------------------------------------------------- anonymity threshold
update system_settings set value = '1000' where key = 'min_respondents';
select pg_temp.as_user((select p.email from faculty f join profiles p on p.id=f.profile_id where faculty_number='FAC-0001')) \g /dev/null
set role authenticated;
select pg_temp.check('faculty blocked below minimum respondents',
  (get_offering_results((select o.id from subject_offerings o join faculty f on f.id=o.faculty_id join academic_periods ap on ap.id=o.academic_period_id
     where f.faculty_number='FAC-0001' and not ap.is_current limit 1)))->>'reason' = 'insufficient_respondents');
select pg_temp.check('faculty analytics excludes sub-threshold classes', (get_faculty_analytics())->'overall_average' = 'null'::jsonb);
reset role;
update system_settings set value = '3' where key = 'min_respondents';

-- ---------------------------------------------------------------- soft delete hides class
select pg_temp.as_user('admin@asscat.edu.ph') \g /dev/null
set role authenticated;
update subject_offerings set deleted_at = now() where id = current_setting('t.off')::uuid;
select pg_temp.check('soft-deleted class hidden from overview', not exists (select 1 from offering_overview where id = current_setting('t.off')::uuid));
select pg_temp.check('soft-deleted class keeps its evaluation records', exists (select 1 from evaluation_attempts where offering_id = current_setting('t.off')::uuid));
reset role;

-- ---------------------------------------------------------------- permanent class deletion (cascade)
-- a failure at the last step rolls back every earlier delete
create function pg_temp.fail_offering_delete() returns trigger language plpgsql as $$ begin raise exception 'forced failure'; end $$;
create trigger t_fail_offering_delete before delete on public.subject_offerings for each row execute function pg_temp.fail_offering_delete();
select set_config('t.rb', (select o.id::text from subject_offerings o where exists (select 1 from evaluation_attempts a where a.offering_id = o.id) order by o.id limit 1), false) \g /dev/null
select set_config('t.rb_counts', ((select count(*) from evaluation_attempts where offering_id = current_setting('t.rb')::uuid)
  + (select count(*) from subject_enrollments where offering_id = current_setting('t.rb')::uuid))::text, false) \g /dev/null
select pg_temp.as_user('admin@asscat.edu.ph') \g /dev/null
set role authenticated;
do $$ begin
  perform admin_delete_offerings(array[current_setting('t.rb')::uuid]);
exception when others then null;
end $$;
reset role;
drop trigger t_fail_offering_delete on public.subject_offerings;
select pg_temp.check('failed class deletion rolls back completely',
  exists (select 1 from subject_offerings where id = current_setting('t.rb')::uuid)
  and ((select count(*) from evaluation_attempts where offering_id = current_setting('t.rb')::uuid)
       + (select count(*) from subject_enrollments where offering_id = current_setting('t.rb')::uuid))::text = current_setting('t.rb_counts'));

select pg_temp.as_user('admin@asscat.edu.ph') \g /dev/null
set role authenticated;
select set_config('t.del', (select o.id::text from subject_offerings o
  where exists (select 1 from evaluation_attempts a join evaluation_comments c on c.attempt_id = a.id where a.offering_id = o.id and a.status = 'completed')
  order by o.id limit 1), false) \g /dev/null
select set_config('t.del_students', (select string_agg(student_id::text, ',') from subject_enrollments where offering_id = current_setting('t.del')::uuid), false) \g /dev/null
select set_config('t.before', json_build_object(
  'offerings', (select count(*) from subject_offerings), 'students', (select count(*) from students), 'faculty', (select count(*) from faculty),
  'subjects', (select count(*) from subjects), 'questions', (select count(*) from questions), 'answers', (select count(*) from evaluation_answers),
  'other_attempts', (select count(*) from evaluation_attempts where offering_id <> current_setting('t.del')::uuid),
  'other_enrollments', (select count(*) from subject_enrollments where offering_id <> current_setting('t.del')::uuid))::text, false) \g /dev/null
select set_config('t.res', admin_delete_offerings(array[current_setting('t.del')::uuid])::text, false) \g /dev/null
select pg_temp.check('class with submitted evaluations can be deleted',
  (current_setting('t.res')::jsonb->>'offerings')::int = 1 and (current_setting('t.res')::jsonb->>'completed')::int > 0
  and (current_setting('t.res')::jsonb->>'answers')::int > 0 and (current_setting('t.res')::jsonb->>'comments')::int > 0);
select pg_temp.check('class, enrollments and attempts are gone',
  not exists (select 1 from subject_offerings where id = current_setting('t.del')::uuid)
  and not exists (select 1 from subject_enrollments where offering_id = current_setting('t.del')::uuid)
  and not exists (select 1 from evaluation_attempts where offering_id = current_setting('t.del')::uuid));
select pg_temp.check('answers removed with the class (no orphans)',
  (select count(*) from evaluation_answers) = (current_setting('t.before')::jsonb->>'answers')::int - (current_setting('t.res')::jsonb->>'answers')::int
  and not exists (select 1 from evaluation_answers x where not exists (select 1 from evaluation_attempts a where a.id = x.attempt_id))
  and not exists (select 1 from evaluation_comments c where not exists (select 1 from evaluation_attempts a where a.id = c.attempt_id)));
select pg_temp.check('other classes, attempts and enrollments untouched',
  (select count(*) from subject_offerings) = (current_setting('t.before')::jsonb->>'offerings')::int - 1
  and (select count(*) from evaluation_attempts) = (current_setting('t.before')::jsonb->>'other_attempts')::int
  and (select count(*) from subject_enrollments) = (current_setting('t.before')::jsonb->>'other_enrollments')::int);
select pg_temp.check('students, faculty, subjects and questions untouched',
  (select count(*) from students) = (current_setting('t.before')::jsonb->>'students')::int
  and (select count(*) from faculty) = (current_setting('t.before')::jsonb->>'faculty')::int
  and (select count(*) from subjects) = (current_setting('t.before')::jsonb->>'subjects')::int
  and (select count(*) from questions) = (current_setting('t.before')::jsonb->>'questions')::int
  and (select count(*) from students where id::text = any(string_to_array(current_setting('t.del_students'), ',')))
      = cardinality(string_to_array(current_setting('t.del_students'), ',')));
select pg_temp.check('bulk delete removes several classes at once',
  (select (admin_delete_offerings((select array_agg(id) from (select id from subject_offerings where exists
     (select 1 from evaluation_attempts a where a.offering_id = subject_offerings.id) order by id limit 2) t))->>'offerings')::int) = 2);
do $$ begin
  perform admin_delete_offerings(array[]::uuid[]);
  raise notice 'FAIL  empty class list accepted';
exception when invalid_parameter_value then raise notice 'PASS  empty class list rejected';
end $$;
do $$ begin
  perform admin_delete_offerings(array[gen_random_uuid()]);
  raise notice 'FAIL  unknown class accepted';
exception when no_data_found then raise notice 'PASS  unknown class reported as not found';
end $$;
reset role;
select pg_temp.as_user((select email from profiles where role = 'student' order by email limit 1)) \g /dev/null
set role authenticated;
do $$ begin
  perform admin_delete_offerings(array[(select id from subject_offerings limit 1)]);
  raise notice 'FAIL  student could delete a class';
exception when insufficient_privilege then raise notice 'PASS  only admins can delete classes';
end $$;
reset role;
select pg_temp.as_user((select email from profiles where role = 'faculty' order by email limit 1)) \g /dev/null
set role authenticated;
do $$ begin
  perform admin_delete_offerings(array[(select id from subject_offerings limit 1)]);
  raise notice 'FAIL  faculty could delete a class';
exception when insufficient_privilege then raise notice 'PASS  faculty cannot delete classes';
end $$;
reset role;

-- ---------------------------------------------------------------- permanent student deletion (cascade)
select pg_temp.as_user('admin@asscat.edu.ph') \g /dev/null
set role authenticated;
select set_config('t.stu', (select a.student_id::text from evaluation_attempts a join evaluation_comments c on c.attempt_id = a.id
  where a.status = 'completed' order by a.student_id limit 1), false) \g /dev/null
select set_config('t.sb', json_build_object(
  'students', (select count(*) from students), 'faculty', (select count(*) from faculty), 'offerings', (select count(*) from subject_offerings),
  'other_attempts', (select count(*) from evaluation_attempts where student_id <> current_setting('t.stu')::uuid),
  'other_enrollments', (select count(*) from subject_enrollments where student_id <> current_setting('t.stu')::uuid),
  'profile', (select profile_id from students where id = current_setting('t.stu')::uuid))::text, false) \g /dev/null
select set_config('t.sres', admin_delete_students(array[current_setting('t.stu')::uuid])::text, false) \g /dev/null
select pg_temp.check('student with submitted evaluations can be deleted',
  jsonb_array_length(current_setting('t.sres')::jsonb->'students') = 1 and (current_setting('t.sres')::jsonb->>'completed')::int > 0
  and (current_setting('t.sres')::jsonb->'students'->0->>'profile_id') = current_setting('t.sb')::jsonb->>'profile');
select pg_temp.check('student, enrollments and attempts are gone (no orphans)',
  not exists (select 1 from students where id = current_setting('t.stu')::uuid)
  and not exists (select 1 from subject_enrollments where student_id = current_setting('t.stu')::uuid)
  and not exists (select 1 from evaluation_attempts where student_id = current_setting('t.stu')::uuid)
  and not exists (select 1 from evaluation_answers x where not exists (select 1 from evaluation_attempts a where a.id = x.attempt_id))
  and not exists (select 1 from evaluation_comments c where not exists (select 1 from evaluation_attempts a where a.id = c.attempt_id)));
select pg_temp.check('other students, classes and faculty untouched',
  (select count(*) from students) = (current_setting('t.sb')::jsonb->>'students')::int - 1
  and (select count(*) from faculty) = (current_setting('t.sb')::jsonb->>'faculty')::int
  and (select count(*) from subject_offerings) = (current_setting('t.sb')::jsonb->>'offerings')::int
  and (select count(*) from evaluation_attempts) = (current_setting('t.sb')::jsonb->>'other_attempts')::int
  and (select count(*) from subject_enrollments) = (current_setting('t.sb')::jsonb->>'other_enrollments')::int);
select pg_temp.check('bulk student delete removes several at once',
  jsonb_array_length((admin_delete_students((select array_agg(student_id) from (select distinct student_id from subject_enrollments order by 1 limit 3) t)))->'students') = 3);
do $$ begin
  perform admin_delete_students(array[gen_random_uuid()]);
  raise notice 'FAIL  unknown student accepted';
exception when no_data_found then raise notice 'PASS  unknown student reported as not found';
end $$;
reset role;
select pg_temp.as_user((select email from profiles where role = 'faculty' order by email limit 1)) \g /dev/null
set role authenticated;
do $$ begin
  perform admin_delete_students(array[(select id from students limit 1)]);
  raise notice 'FAIL  faculty could delete a student';
exception when insufficient_privilege then raise notice 'PASS  only admins can delete students';
end $$;
reset role;

-- ---------------------------------------------------------------- GoTrue createUser order
-- Supabase Auth inserts the user, then sets app_metadata in a later UPDATE.
insert into auth.users (id, email, raw_app_meta_data) values ('11111111-1111-4111-8111-111111111111', 'gotrue.order@test.local', '{"provider":"email"}');
select pg_temp.check('no profile before role is set', not exists (select 1 from profiles where id = '11111111-1111-4111-8111-111111111111'));
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"faculty","must_change_password":true}' where id = '11111111-1111-4111-8111-111111111111';
select pg_temp.check('profile created when role arrives via UPDATE',
  exists (select 1 from profiles where id = '11111111-1111-4111-8111-111111111111' and role = 'faculty' and must_change_password));
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"x":1}' where id = '11111111-1111-4111-8111-111111111111';
select pg_temp.check('repeat metadata updates stay idempotent', (select count(*) from profiles where id = '11111111-1111-4111-8111-111111111111') = 1);
