-- =============================================================================
-- ASSCAT iRATE — Permanently delete students with their dependent records
-- Removes students together with every record that belongs to them, in one
-- transaction (one function call):
--
--   students
--     ├─ evaluation_attempts  (FK offering_id+student_id → enrollments, RESTRICT)
--     │    ├─ evaluation_answers   (ON DELETE CASCADE)
--     │    └─ evaluation_comments  (ON DELETE CASCADE)
--     └─ subject_enrollments  (FK student_id, RESTRICT)
--
-- Classes (subject_offerings), faculty, subjects, questions and other students
-- are never touched. The login accounts (auth.users → profiles) are removed by
-- the application afterwards with the Auth admin API, as for a single delete.
-- =============================================================================
create or replace function public.admin_delete_students(p_student_ids uuid[])
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ids         uuid[];
  v_completed   int;
  v_attempts    int;
  v_enrollments int;
  v_students    jsonb;
begin
  perform public._require_admin();
  if coalesce(cardinality(p_student_ids), 0) = 0 then
    raise exception 'Select at least one student to delete' using errcode = '22023';
  end if;

  -- Lock the students so no enrollment/evaluation is added for them meanwhile.
  select array_agg(id) into v_ids
  from (select s.id from public.students s where s.id = any(p_student_ids) order by s.id for update) t;
  if v_ids is null then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;

  select count(*) filter (where a.status = 'completed') into v_completed
  from public.evaluation_attempts a where a.student_id = any(v_ids);

  -- Children first (answers + comments cascade from their attempt).
  delete from public.evaluation_attempts where student_id = any(v_ids);
  get diagnostics v_attempts = row_count;
  delete from public.subject_enrollments where student_id = any(v_ids);
  get diagnostics v_enrollments = row_count;

  with d as (delete from public.students where id = any(v_ids) returning id, student_number, profile_id)
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'student_number', student_number, 'profile_id', profile_id)), '[]'::jsonb)
    into v_students from d;

  return jsonb_build_object(
    'students', v_students,
    'enrollments', v_enrollments,
    'attempts', v_attempts,
    'completed', v_completed
  );
end;
$$;

revoke execute on function public.admin_delete_students(uuid[]) from public, anon;
grant execute on function public.admin_delete_students(uuid[]) to authenticated;
