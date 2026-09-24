-- =============================================================================
-- ASSCAT iRATE — Permanently delete survey classes (subject offerings)
-- Removes one or more subject_offerings together with every record that
-- depends on them, in a single transaction (one function call):
--
--   subject_offerings
--     ├─ evaluation_attempts  (FK offering_id+period, RESTRICT)
--     │    ├─ evaluation_answers   (ON DELETE CASCADE)
--     │    └─ evaluation_comments  (ON DELETE CASCADE)
--     └─ subject_enrollments  (FK offering_id, RESTRICT; attempts also reference it)
--
-- Students, faculty, subjects, questions, periods and other offerings are
-- never touched. Activity logs are append-only audit history and are kept.
-- Answers/comments of completed attempts are removed through the attempt
-- cascade (the lock trigger allows this once the parent attempt is gone),
-- exactly like admin_reset_evaluation.
-- =============================================================================
create or replace function public.admin_delete_offerings(p_offering_ids uuid[])
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ids         uuid[];
  v_answers     int;
  v_comments    int;
  v_completed   int;
  v_attempts    int;
  v_enrollments int;
  v_offerings   int;
begin
  perform public._require_admin();
  if coalesce(cardinality(p_offering_ids), 0) = 0 then
    raise exception 'Select at least one class to delete' using errcode = '22023';
  end if;

  -- Lock the classes first: concurrent evaluation submissions or enrollments
  -- (whose FK checks need a key-share lock on the class) wait, then fail
  -- cleanly once the class is gone, so nothing is left orphaned.
  select array_agg(id) into v_ids
  from (select o.id from public.subject_offerings o where o.id = any(p_offering_ids) order by o.id for update) t;
  if v_ids is null then
    raise exception 'Class not found' using errcode = 'P0002';
  end if;

  select count(*) into v_answers
  from public.evaluation_answers x join public.evaluation_attempts a on a.id = x.attempt_id
  where a.offering_id = any(v_ids);
  select count(*) into v_comments
  from public.evaluation_comments c join public.evaluation_attempts a on a.id = c.attempt_id
  where a.offering_id = any(v_ids);
  select count(*) filter (where a.status = 'completed') into v_completed
  from public.evaluation_attempts a where a.offering_id = any(v_ids);

  -- Children first (answers + comments cascade from their attempt).
  delete from public.evaluation_attempts where offering_id = any(v_ids);
  get diagnostics v_attempts = row_count;
  delete from public.subject_enrollments where offering_id = any(v_ids);
  get diagnostics v_enrollments = row_count;
  delete from public.subject_offerings where id = any(v_ids);
  get diagnostics v_offerings = row_count;

  return jsonb_build_object(
    'offering_ids', to_jsonb(v_ids),
    'offerings', v_offerings,
    'enrollments', v_enrollments,
    'attempts', v_attempts,
    'completed', v_completed,
    'answers', v_answers,
    'comments', v_comments
  );
end;
$$;

revoke execute on function public.admin_delete_offerings(uuid[]) from public, anon;
grant execute on function public.admin_delete_offerings(uuid[]) to authenticated;
