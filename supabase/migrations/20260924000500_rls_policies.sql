-- =============================================================================
-- ASSCAT iRATE — Row Level Security, grants and function privileges
--
-- Principles
--  * anon has no table access at all.
--  * Admin: full management through RLS (is_admin()).
--  * Student: own profile/student row, own enrollments/attempts/answers (read);
--    evaluation writes only through validated SECURITY DEFINER functions.
--  * Faculty: own profile/faculty row and own offerings. NO access to
--    enrollments, attempts, answers or comments (student identities); results
--    only through aggregate functions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere
-- -----------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.departments         enable row level security;
alter table public.programs            enable row level security;
alter table public.year_levels         enable row level security;
alter table public.students            enable row level security;
alter table public.faculty             enable row level security;
alter table public.academic_periods    enable row level security;
alter table public.subjects            enable row level security;
alter table public.subject_offerings   enable row level security;
alter table public.subject_enrollments enable row level security;
alter table public.question_categories enable row level security;
alter table public.questions           enable row level security;
alter table public.evaluation_attempts enable row level security;
alter table public.evaluation_answers  enable row level security;
alter table public.evaluation_comments enable row level security;
alter table public.notifications       enable row level security;
alter table public.activity_logs       enable row level security;
alter table public.system_settings     enable row level security;

-- -----------------------------------------------------------------------------
-- Table privileges: nothing for anon; authenticated gets the verbs that the
-- policies below further restrict.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Views are read-only.
revoke insert, update, delete on
  public.department_overview, public.program_overview, public.student_overview, public.faculty_overview,
  public.period_overview, public.category_overview, public.question_overview, public.offering_overview,
  public.enrollment_overview, public.activity_log_overview
from authenticated;

-- Column-level restrictions for self-service updates.
revoke update on public.profiles from authenticated;
grant update (first_name, middle_name, last_name, avatar_path) on public.profiles to authenticated;
revoke update, insert on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
grant insert on public.notifications to authenticated; -- admin-only via policy
-- Activity logs are written by the server with the service role only.
revoke insert, update, delete on public.activity_logs from authenticated;
-- Evaluation data is never written directly by clients (functions only);
-- admins may delete (reset) attempts.
revoke insert, update on public.evaluation_attempts, public.evaluation_answers, public.evaluation_comments from authenticated;
revoke delete on public.evaluation_answers, public.evaluation_comments from authenticated;

-- -----------------------------------------------------------------------------
-- Profiles
-- -----------------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_admin_update on public.profiles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Reference data (non-sensitive): readable by any signed-in user,
-- writable by administrators.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['departments', 'programs', 'year_levels', 'academic_periods',
                           'subjects', 'question_categories', 'questions']
  loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (true)', t);
    execute format('create policy %1$s_admin_insert on public.%1$s for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy %1$s_admin_update on public.%1$s for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy %1$s_admin_delete on public.%1$s for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Students: own row or admin.
-- -----------------------------------------------------------------------------
create policy students_select on public.students for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()));
create policy students_admin_insert on public.students for insert to authenticated
  with check ((select public.is_admin()));
create policy students_admin_update on public.students for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy students_admin_delete on public.students for delete to authenticated
  using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Faculty: own row or admin. (Students receive instructor name/photo through
-- get_student_evaluations / get_evaluation_form, never birthday/email.)
-- -----------------------------------------------------------------------------
create policy faculty_select on public.faculty for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()));
create policy faculty_admin_insert on public.faculty for insert to authenticated
  with check ((select public.is_admin()));
create policy faculty_admin_update on public.faculty for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy faculty_admin_delete on public.faculty for delete to authenticated
  using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Subject offerings: admin; faculty (own classes); students (enrolled).
-- -----------------------------------------------------------------------------
create policy subject_offerings_select on public.subject_offerings for select to authenticated
  using (
    (select public.is_admin())
    or faculty_id = (select public.current_faculty_id())
    or exists (select 1 from public.subject_enrollments e
               where e.offering_id = subject_offerings.id
                 and e.student_id = (select public.current_student_id()))
  );
create policy subject_offerings_admin_insert on public.subject_offerings for insert to authenticated
  with check ((select public.is_admin()));
create policy subject_offerings_admin_update on public.subject_offerings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy subject_offerings_admin_delete on public.subject_offerings for delete to authenticated
  using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Enrollments: admin; students (own). Faculty cannot list who is enrolled.
-- -----------------------------------------------------------------------------
create policy subject_enrollments_select on public.subject_enrollments for select to authenticated
  using ((select public.is_admin()) or student_id = (select public.current_student_id()));
create policy subject_enrollments_admin_insert on public.subject_enrollments for insert to authenticated
  with check ((select public.is_admin()));
create policy subject_enrollments_admin_delete on public.subject_enrollments for delete to authenticated
  using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Evaluation data: admin + owning student may read; admin may reset (delete).
-- -----------------------------------------------------------------------------
create policy evaluation_attempts_select on public.evaluation_attempts for select to authenticated
  using ((select public.is_admin()) or student_id = (select public.current_student_id()));
create policy evaluation_attempts_admin_delete on public.evaluation_attempts for delete to authenticated
  using ((select public.is_admin()));

create policy evaluation_answers_select on public.evaluation_answers for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.evaluation_attempts a
               where a.id = evaluation_answers.attempt_id
                 and a.student_id = (select public.current_student_id()))
  );

create policy evaluation_comments_select on public.evaluation_comments for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.evaluation_attempts a
               where a.id = evaluation_comments.attempt_id
                 and a.student_id = (select public.current_student_id()))
  );

-- -----------------------------------------------------------------------------
-- Notifications: own; admins may create for anyone.
-- -----------------------------------------------------------------------------
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_admin_insert on public.notifications for insert to authenticated
  with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Activity logs: admin read only.
-- -----------------------------------------------------------------------------
create policy activity_logs_admin_select on public.activity_logs for select to authenticated
  using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- System settings: public keys readable by all signed-in users; admin writes.
-- -----------------------------------------------------------------------------
create policy system_settings_select on public.system_settings for select to authenticated
  using (is_public or (select public.is_admin()));
create policy system_settings_admin_insert on public.system_settings for insert to authenticated
  with check ((select public.is_admin()));
create policy system_settings_admin_update on public.system_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Function privileges. Revoke the Supabase default (anon + public) and grant
-- only what each role needs. Internal/trigger functions are not callable.
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.current_app_role(),
  public.is_admin(),
  public.current_student_id(),
  public.current_faculty_id(),
  public.format_person_name(text, text, text),
  public.period_status(timestamptz, timestamptz),
  public.get_setting(text),
  public.complete_password_change(),
  public.touch_last_login(),
  public.get_student_evaluations(uuid),
  public.get_student_periods(),
  public.get_evaluation_form(uuid),
  public.save_evaluation_progress(uuid, jsonb, text),
  public.submit_evaluation(uuid, jsonb, text),
  public.results_visible(uuid),
  public.min_respondents(),
  public.get_faculty_offerings(uuid),
  public.get_offering_results(uuid),
  public.get_faculty_analytics(uuid, uuid),
  public.admin_set_current_period(uuid),
  public.admin_release_results(uuid, boolean),
  public.admin_reset_evaluation(uuid),
  public.admin_import_course_rows(jsonb),
  public.admin_import_evaluation_rows(jsonb),
  public.admin_analytics(uuid, int, int, uuid, uuid, uuid, uuid),
  public.generate_scheduled_notifications()
to authenticated;

grant execute on function public.generate_scheduled_notifications() to service_role;

-- Future functions must be granted explicitly.
alter default privileges in schema public revoke execute on functions from public, anon;
