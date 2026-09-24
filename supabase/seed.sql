-- =============================================================================
-- ASSCAT iRATE — Development seed data
--
-- Demo accounts (CHANGE OR REMOVE BEFORE PRODUCTION):
--   Administrator : admin@asscat.edu.ph          / Admin@12345
--   Faculty       : <firstname>.<lastname>@asscat.edu.ph / Faculty@12345
--                   e.g. maria.santos@asscat.edu.ph
--   Student       : <student id>@student.asscat.edu.ph / Student@12345
--                   e.g. 2026-0001@student.asscat.edu.ph (or log in with ID 2026-0001)
-- =============================================================================

select setseed(0.20260924);

-- -----------------------------------------------------------------------------
-- Helper: create a confirmed email/password auth user (fires profile trigger)
-- -----------------------------------------------------------------------------
-- A throwaway schema (dropped at the end) is used because Supabase's seed
-- runner prepares all statements up front: the helper is created and called
-- only inside DO blocks, which resolve names at execution time.
do $seed$
begin
  create schema if not exists seed_util;
  execute $fn$
create or replace function seed_util.seed_user(p_email text, p_password text, p_role text,
                                             p_first text, p_last text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', lower(p_email),
          extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
          jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', p_role),
          jsonb_build_object('first_name', p_first, 'last_name', p_last),
          now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', lower(p_email), 'email_verified', true),
          'email', now(), now(), now());
  return v_id;
end;
$$
  $fn$;
end $seed$;

-- -----------------------------------------------------------------------------
-- Administrator
-- -----------------------------------------------------------------------------
do $$ begin perform seed_util.seed_user('admin@asscat.edu.ph', 'Admin@12345', 'admin', 'System', 'Administrator'); end $$;

-- -----------------------------------------------------------------------------
-- Departments, programs, year levels
-- -----------------------------------------------------------------------------
insert into public.departments (code, name) values
  ('CEIT', 'College of Engineering and Information Technology'),
  ('CTE',  'College of Teacher Education'),
  ('CBM',  'College of Business and Management'),
  ('CA',   'College of Agriculture'),
  ('CAS',  'College of Arts and Sciences');

insert into public.programs (code, name, department_id)
select v.code, v.name, d.id
from (values
  ('BSIT',  'Bachelor of Science in Information Technology', 'CEIT'),
  ('BSCE',  'Bachelor of Science in Civil Engineering',      'CEIT'),
  ('BEED',  'Bachelor of Elementary Education',              'CTE'),
  ('BSED',  'Bachelor of Secondary Education',               'CTE'),
  ('BSBA',  'Bachelor of Science in Business Administration','CBM'),
  ('BSHM',  'Bachelor of Science in Hospitality Management', 'CBM'),
  ('BSA',   'Bachelor of Science in Agriculture',            'CA'),
  ('ABENG', 'Bachelor of Arts in English Language',          'CAS')
) as v(code, name, dept)
join public.departments d on d.code = v.dept;

insert into public.year_levels (name, sort_order) values
  ('1st Year', 1), ('2nd Year', 2), ('3rd Year', 3), ('4th Year', 4);

-- -----------------------------------------------------------------------------
-- Question bank
-- -----------------------------------------------------------------------------
insert into public.question_categories (name, description, sort_order) values
  ('Teaching Competence',   'Mastery of the subject matter and effectiveness of instruction.', 1),
  ('Communication',         'Clarity of explanations and openness to student questions.', 2),
  ('Classroom Management',  'Organization, time management and learning environment.', 3),
  ('Professionalism',       'Punctuality, fairness, and ethical conduct.', 4),
  ('Student Engagement',    'Encouragement of participation and critical thinking.', 5);

insert into public.questions (category_id, title, content, sort_order)
select c.id, v.title, v.content, v.sort
from (values
  ('Teaching Competence', 'TC-1', 'Demonstrates mastery of the subject matter.', 1),
  ('Teaching Competence', 'TC-2', 'Relates the lesson to real-life situations and current developments.', 2),
  ('Teaching Competence', 'TC-3', 'Uses teaching strategies appropriate to the lesson and learners.', 3),
  ('Teaching Competence', 'TC-4', 'Provides assessments that are aligned with the learning objectives.', 4),
  ('Communication', 'CO-1', 'Explains concepts clearly and in an organized manner.', 1),
  ('Communication', 'CO-2', 'Encourages students to ask questions and responds to them respectfully.', 2),
  ('Communication', 'CO-3', 'Gives clear instructions for activities and requirements.', 3),
  ('Communication', 'CO-4', 'Provides timely and constructive feedback on student work.', 4),
  ('Classroom Management', 'CM-1', 'Starts and ends classes on time.', 1),
  ('Classroom Management', 'CM-2', 'Maintains an orderly and conducive learning environment.', 2),
  ('Classroom Management', 'CM-3', 'Uses class time efficiently.', 3),
  ('Professionalism', 'PR-1', 'Treats all students fairly and with respect.', 1),
  ('Professionalism', 'PR-2', 'Comes to class prepared.', 2),
  ('Professionalism', 'PR-3', 'Is available for consultation during announced hours.', 3),
  ('Professionalism', 'PR-4', 'Observes grading policies that are transparent and consistent.', 4),
  ('Student Engagement', 'SE-1', 'Encourages active participation in class discussions.', 1),
  ('Student Engagement', 'SE-2', 'Stimulates critical and creative thinking.', 2),
  ('Student Engagement', 'SE-3', 'Motivates students to do their best.', 3)
) as v(cat, title, content, sort)
join public.question_categories c on c.name = v.cat;

-- -----------------------------------------------------------------------------
-- Academic periods (today in the demo timeline: 1st Sem 2026-2027 is open)
-- -----------------------------------------------------------------------------
insert into public.academic_periods (start_year, semester, open_at, close_at, is_current, results_released_at) values
  (2024, 1, '2024-11-18 08:00+08', '2024-12-13 17:00+08', false, '2024-12-20 08:00+08'),
  (2024, 2, '2025-04-14 08:00+08', '2025-05-09 17:00+08', false, '2025-05-16 08:00+08'),
  (2025, 1, '2025-11-17 08:00+08', '2025-12-12 17:00+08', false, '2025-12-19 08:00+08'),
  (2025, 2, '2026-04-13 08:00+08', '2026-05-08 17:00+08', false, '2026-05-15 08:00+08'),
  (2026, 1, date_trunc('day', now()) - interval '9 days' + interval '8 hours',
            date_trunc('day', now()) + interval '21 days' + interval '17 hours', true, null);

-- -----------------------------------------------------------------------------
-- Subjects
-- -----------------------------------------------------------------------------
insert into public.subjects (code, title, units) values
  ('IT 101',  'Introduction to Computing', 3),
  ('IT 102',  'Computer Programming 1', 3),
  ('IT 201',  'Data Structures and Algorithms', 3),
  ('IT 202',  'Information Management', 3),
  ('IT 301',  'Web Systems and Technologies', 3),
  ('CE 211',  'Engineering Mechanics', 3),
  ('EDUC 101','The Child and Adolescent Learners', 3),
  ('EDUC 204','Assessment in Learning', 3),
  ('BA 101',  'Principles of Management', 3),
  ('HM 110',  'Fundamentals in Food Service Operations', 3),
  ('AGRI 101','Fundamentals of Crop Science', 3),
  ('ENG 110', 'Purposive Communication', 3),
  ('GE 104',  'Mathematics in the Modern World', 3),
  ('GE 105',  'Science, Technology and Society', 3);

-- -----------------------------------------------------------------------------
-- Faculty (with auth accounts)
-- -----------------------------------------------------------------------------
do $$
declare
  f record;
  v_uid uuid;
begin
  for f in
    select * from (values
      ('FAC-0001', 'Maria',     'Lopez',    'Santos',    'BSIT',  '1984-03-12'::date, '2010-06-01'::date),
      ('FAC-0002', 'Jose',      'Garcia',   'Reyes',     'BSIT',  '1990-07-25', '2016-06-01'),
      ('FAC-0003', 'Ana',       'Mendoza',  'Cruz',      'BSCE',  '1979-11-02', '2005-06-15'),
      ('FAC-0004', 'Ramon',     'Villanueva','Bautista', 'BEED',  '1972-01-19', '1999-06-01'),
      ('FAC-0005', 'Liza',      'Torres',   'Gonzales',  'BSED',  '1995-05-30', '2021-08-01'),
      ('FAC-0006', 'Carlo',     'Aquino',   'Ramos',     'BSBA',  '1987-09-14', '2013-06-01'),
      ('FAC-0007', 'Kristine',  'Flores',   'Dela Cruz', 'BSHM',  '1999-02-08', '2025-08-01'),
      ('FAC-0008', 'Eduardo',   'Castillo', 'Navarro',   'BSA',   '1968-12-01', '1994-06-01'),
      ('FAC-0009', 'Grace',     'Morales',  'Fernandez', 'ABENG', '1983-06-21', '2009-06-01'),
      ('FAC-0010', 'Mark',      'Salazar',  'Domingo',   'BSIT',  '1993-10-10', '2019-06-01'),
      ('FAC-0011', 'Rowena',    'Pascual',  'Aguilar',   'BSA',   '1976-04-04', '2003-06-01'),
      ('FAC-0012', 'Nestor',    'Rivera',   'Mercado',   'BSCE',  '1998-08-17', '2024-08-01')
    ) as t(num, first, middle, last, prog, bday, started)
  loop
    v_uid := seed_util.seed_user(
      lower(replace(f.first, ' ', '') || '.' || replace(f.last, ' ', '')) || '@asscat.edu.ph',
      'Faculty@12345', 'faculty', f.first, f.last);
    insert into public.faculty (profile_id, faculty_number, first_name, middle_name, last_name, email,
                                birthday, date_started, program_id, department_id)
    select v_uid, f.num, f.first, f.middle, f.last,
           lower(replace(f.first, ' ', '') || '.' || replace(f.last, ' ', '')) || '@asscat.edu.ph',
           f.bday, f.started, p.id, p.department_id
    from public.programs p where p.code = f.prog;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Students (with auth accounts). 12 per program across year levels.
-- -----------------------------------------------------------------------------
do $$
declare
  firsts text[] := array['Juan','Maria','Jose','Angela','Mark','Kristine','John','Princess','Carlo','Jasmine',
                         'Paolo','Nicole','Christian','Andrea','Miguel','Camille','Rafael','Bea','Joshua','Althea',
                         'Kenneth','Shane','Vincent','Trisha','Adrian','Ella','Jerome','Mika','Ronald','Hazel'];
  lasts  text[] := array['Dela Cruz','Garcia','Reyes','Ramos','Mendoza','Santos','Flores','Gonzales','Bautista',
                         'Villanueva','Fernandez','Cruz','De Guzman','Lopez','Perez','Castillo','Francisco','Rivera',
                         'Aquino','Castro','Sanchez','Torres','De Leon','Domingo','Martinez','Rodriguez','Soriano',
                         'Salvador','Navarro','Pascual'];
  middles text[] := array['Abad','Belmonte','Cabrera','Dizon','Espiritu','Fajardo','Galang','Hernandez','Ignacio','Javier'];
  p record;
  v_n int := 0;
  v_first text; v_last text; v_num text; v_uid uuid; v_year int;
  i int;
begin
  for p in select id, code from public.programs order by code loop
    for i in 1..12 loop
      v_n := v_n + 1;
      v_year := ((i - 1) % 4) + 1;
      v_first := firsts[1 + ((v_n * 7) % array_length(firsts, 1))];
      v_last  := lasts[1 + ((v_n * 11) % array_length(lasts, 1))];
      v_num   := (2027 - v_year)::text || '-' || lpad(v_n::text, 4, '0');
      v_uid := seed_util.seed_user(v_num || '@student.asscat.edu.ph', 'Student@12345', 'student', v_first, v_last);
      insert into public.students (profile_id, student_number, first_name, middle_name, last_name, email,
                                   program_id, year_level_id)
      select v_uid, v_num, v_first, middles[1 + (v_n % array_length(middles, 1))], v_last,
             v_num || '@student.asscat.edu.ph', p.id, y.id
      from public.year_levels y where y.sort_order = v_year;
    end loop;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Offerings + enrollments for every period.
-- Each faculty teaches 1–2 classes per period to students of their program.
-- -----------------------------------------------------------------------------
do $$
declare
  ap record; f record; s record;
  v_subjects text[];
  v_offering uuid;
  k int;
begin
  for ap in select * from public.academic_periods order by start_year, semester loop
    for f in select fa.*, p.code as prog from public.faculty fa join public.programs p on p.id = fa.program_id loop
      -- Skip faculty that had not started yet at that time.
      continue when f.date_started > ap.open_at::date;
      v_subjects := case f.prog
        when 'BSIT'  then array['IT 101','IT 102','IT 201','IT 202','IT 301']
        when 'BSCE'  then array['CE 211','GE 104']
        when 'BEED'  then array['EDUC 101','EDUC 204']
        when 'BSED'  then array['EDUC 204','EDUC 101']
        when 'BSBA'  then array['BA 101','GE 105']
        when 'BSHM'  then array['HM 110','GE 105']
        when 'BSA'   then array['AGRI 101','GE 105']
        else array['ENG 110','GE 104'] end;
      for k in 1..(1 + (ap.semester % 2)) loop
        insert into public.subject_offerings (subject_id, faculty_id, program_id, academic_period_id, section)
        select sub.id, f.id, f.program_id, ap.id, chr(64 + k)
        from public.subjects sub
        where sub.code = v_subjects[1 + ((ap.start_year + ap.semester + k + length(f.faculty_number::text) + (substring(f.faculty_number from 5)::int)) % array_length(v_subjects, 1))]
        on conflict do nothing
        returning id into v_offering;
        continue when v_offering is null;

        insert into public.subject_enrollments (offering_id, student_id)
        select v_offering, st.id
        from public.students st
        where st.program_id = f.program_id
          and random() < 0.85
        on conflict do nothing;
      end loop;
    end loop;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Evaluations
--   Closed periods: ~88% completion. Current period: ~40% completed, ~10% in progress.
--   Each faculty has a latent quality so rankings are meaningful.
-- -----------------------------------------------------------------------------
do $$
declare
  e record;
  v_attempt uuid;
  v_roll double precision;
  v_quality numeric;
  v_comments text[] := array[
    'Very knowledgeable and explains the lessons clearly.',
    'I hope there will be more hands-on activities.',
    'Thank you for your patience in answering our questions.',
    'Sometimes the discussion is too fast. Please slow down a little.',
    'The examples used in class are very helpful.',
    'Please provide the rubrics before the deadline of projects.',
    'One of the best instructors I have had. Very approachable.',
    'Classes sometimes start late.',
    'The feedback on our outputs helped me improve a lot.',
    'I appreciate how the instructor relates lessons to real life.',
    'More review sessions before exams would be great.',
    'Fair in grading and treats everyone equally.'];
  v_submitted timestamptz;
begin
  for e in
    select en.offering_id, en.student_id, o.academic_period_id, o.faculty_id,
           ap.open_at, ap.close_at, ap.is_current
    from public.subject_enrollments en
    join public.subject_offerings o on o.id = en.offering_id
    join public.academic_periods ap on ap.id = o.academic_period_id
    order by ap.start_year, ap.semester, en.offering_id, en.student_id
  loop
    v_roll := random();
    continue when (not e.is_current and v_roll > 0.88) or (e.is_current and v_roll > 0.50);

    -- latent faculty quality in [3.1, 4.7]
    v_quality := 3.1 + ((('x' || substr(md5(e.faculty_id::text), 1, 6))::bit(24)::int) % 17) / 10.0;

    insert into public.evaluation_attempts (offering_id, student_id, academic_period_id, started_at)
    values (e.offering_id, e.student_id, e.academic_period_id,
            least(e.open_at + random() * (least(e.close_at, now()) - e.open_at), now()))
    returning id into v_attempt;

    insert into public.evaluation_answers (attempt_id, question_id, category_id, rating, scale_max, rating_label,
                                           category_name, question_title, question_text)
    select v_attempt, q.id, c.id, r.rating, 5,
           (array['Poor','Fair','Good','Very Good','Excellent'])[r.rating],
           c.name, q.title, q.content
    from public.questions q
    join public.question_categories c on c.id = q.category_id
    cross join lateral (
      select greatest(1, least(5, round(v_quality + (c.sort_order - 3) * 0.08
                                        + (random() + random() + random() - 1.5) * 1.3)))::smallint as rating
    ) r;

    if random() < 0.40 then
      insert into public.evaluation_comments (attempt_id, comment)
      values (v_attempt, v_comments[1 + floor(random() * array_length(v_comments, 1))::int]);
    end if;

    if not e.is_current or v_roll <= 0.40 then
      select started_at + (random() * interval '20 minutes') into v_submitted
      from public.evaluation_attempts where id = v_attempt;
      update public.evaluation_attempts
         set status = 'completed', submitted_at = least(v_submitted, now()),
             average_rating = (select round(avg(rating), 3) from public.evaluation_answers where attempt_id = v_attempt)
       where id = v_attempt;
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- A few activity log and notification examples
-- -----------------------------------------------------------------------------
insert into public.activity_logs (user_id, user_name, role, action, module, description)
select p.id, 'System Administrator', 'admin', 'Seeded demo data', 'System', 'Development seed data loaded'
from public.profiles p where p.email = 'admin@asscat.edu.ph';

insert into public.notifications (user_id, title, message, type, link, dedupe_key)
select p.id, 'Welcome to ASSCAT iRATE', 'The demo environment is ready. Explore the dashboard to get started.',
       'success', '/admin/dashboard', 'welcome'
from public.profiles p where p.role = 'admin';

drop schema seed_util cascade;
