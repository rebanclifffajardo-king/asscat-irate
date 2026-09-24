# ASSCAT iRATE — Faculty Evaluation System

Students evaluate the instructors of the subjects they are enrolled in each semester. Administrators run evaluation periods and master data, and read the reports. Faculty see anonymous, aggregate results for their own classes.

**Stack:** Next.js 16 (App Router, Server Components, Server Actions, `proxy.ts`) · TypeScript · Tailwind CSS v4 · Supabase (Postgres, Auth, RLS, Storage) · Zod · Recharts · ExcelJS / PapaParse · Vercel.

---

## 1. Quick start (local)

```bash
npm install
cp .env.example .env.local        # fill in Supabase URL + keys
```

### Option A — Supabase CLI (requires Docker Desktop)

```bash
supabase start                    # applies supabase/migrations + supabase/seed.sql
supabase status                   # copy API URL, anon key, service_role key into .env.local
npm run dev
```

### Option B — hosted Supabase project

1. Create a project at supabase.com and copy **Project URL**, **anon key** and **service_role key** into `.env.local`.
2. Apply the migrations: `supabase link --project-ref <ref>`, then `supabase db push`. You can also run every file in `supabase/migrations/` in order in the SQL editor.
3. **Development projects only:** run `supabase/seed.sql` in the SQL editor to load demo data.
4. `npm run dev` → http://localhost:3000

### Demo accounts (from `seed.sql`) — delete or change these before production

| Role | Login | Password |
|---|---|---|
| Administrator | `admin@asscat.edu.ph` | `Admin@12345` |
| Faculty | `maria.santos@asscat.edu.ph` (or ID `FAC-0001`) | `Faculty@12345` |
| Student | `2026-0001@student.asscat.edu.ph` (or ID `2026-0001`) | `Student@12345` |

The seed creates 5 departments, 8 programs, 12 faculty, 96 students, 5 semesters (2024-2025 → the 1st Semester of 2026-2027, which is **open now**), 18 questions in 5 categories, and about 720 completed evaluations.

---

## 2. Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Public anon key. RLS protects all data. |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Account administration, login-by-ID lookup, tamper-proof activity logs, cron |
| `NEXT_PUBLIC_SITE_URL` | server | Base URL used in password-reset emails |
| `CRON_SECRET` | server | Protects `/api/cron/notifications` |

The service role key is imported only in `lib/supabase/admin.ts`, which is marked `server-only`. A build that pulls it into client code fails.

---

## 3. Supabase configuration checklist (production)

- **Authentication → Sign In / Providers → Email:** turn **off** "Allow new users to sign up". Accounts are created only by administrators (`supabase/config.toml` already does this for local).
- **Authentication → URL Configuration:** set Site URL to your domain and add `https://<domain>/auth/confirm` to Redirect URLs.
- **Password policy:** minimum 8 characters, with lowercase, uppercase and digits (this matches the app's validation).
- **SMTP:** set up a custom SMTP provider for password-reset emails. The built-in mailer is rate-limited.
- **Optional email template** (Reset Password), which is more reliable across devices than the PKCE link:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
- **Storage:** the migrations create the buckets `faculty-photos`, `avatars` and `system-assets` with size and MIME limits and policies. No manual steps are needed.
- **Remove the demo accounts** if the seed was ever run on this project.

## 4. Deploying to Vercel

1. Import the repository in Vercel. The framework is detected automatically.
2. Add the five environment variables above for Production and Preview. Generate `CRON_SECRET` with `openssl rand -hex 32`.
3. Deploy. `vercel.json` schedules `/api/cron/notifications` daily. The cron sends "period started", "closing soon", "closed" and "results released" notifications and is safe to run repeatedly. The admin dashboard also triggers it when it loads.
4. Put the production URL into the Supabase URL configuration (section 3).

---

## 5. Architecture

```
app/
  (auth)/            login, forgot/reset/forced change password + actions
  auth/              email-link handler (/auth/confirm), no-access page
  admin/             dashboard, surveys (+[id], imports), subjects, questions, categories,
                     students (+[id]), faculty (+[id]), reports, settings, activity-log, profile
  faculty/           dashboard, results (+[offeringId]), profile
  student/           dashboard, evaluate/[offeringId], profile
  print/reports      printable report (outside the app shell)
  api/               reports/export (CSV/XLSX), cron/notifications
components/
  ui/  layout/  brand/  charts/  admin/  evaluation/  reports/  profile/  auth/
lib/
  supabase/ (server, browser, admin, proxy)   auth/ (DAL, roles, accounts, login resolver)
  validation/ (zod)  analytics/  import/ (CSV/XLSX parse + validate)  data/  hooks/
supabase/
  migrations/  seed.sql  tests/  config.toml
types/database.ts    generated Database types
proxy.ts             session refresh + optimistic role routing
```

### Data model (normalized)

`departments` ← `programs` ← `students` / `faculty` (a composite FK plus a trigger keep the faculty department equal to the program's department) · `year_levels` · `academic_periods` (one row per school year + semester, with a single "current" period) · `subjects` → `subject_offerings` (subject + faculty + program + period + section; soft-deleted) → `subject_enrollments` → `evaluation_attempts` (unique per student + offering + period; composite FKs guarantee enrollment and a matching period) → `evaluation_answers` / `evaluation_comments` · `question_categories` → `questions` · `notifications` · `activity_logs` (append-only) · `system_settings`.

**Historical integrity:** each answer stores a snapshot of the question title and text, the category name, the rating label and the scale maximum at submission. Editing or deactivating a question never changes past results. Questions that have been answered cannot be deleted, only deactivated.

### Security model — defense in depth

1. **Proxy** (`proxy.ts`): refreshes the session. It routes users by the verified JWT `app_metadata.role` and forces a password change for temporary passwords. This is an optimistic layer only.
2. **Data Access Layer** (`lib/auth/session.ts`): every layout and page calls `requireRole()`. Every Server Action calls `assertRole()` against the `profiles` table, which is the source of truth.
3. **Row Level Security** on every table:
   - `anon` has no table access.
   - Students read only their own rows.
   - Faculty cannot read enrollments, attempts, answers or comments at all.
4. **Validated SECURITY DEFINER functions** perform all evaluation writes. They enforce enrollment, the open window, the question and scale range, required answers, no duplicates, and no edits after submission. Triggers lock completed evaluations.
5. **Faculty results** come only from aggregate functions that check ownership, release rules and a minimum-respondent threshold. They return comments in pseudo-random order, without identities or timestamps.
6. **Activity logs** are written with the service role and are append-only (a trigger rejects UPDATE and DELETE). Clients cannot insert or forge entries.
7. **Uploads** are checked for size, declared type and magic bytes. SVG is not allowed. Imports are limited to 5 MB and re-validated on the server at commit, then applied in a single transaction.
8. **Headers:** `X-Frame-Options: DENY`, `nosniff`, `frame-ancestors 'none'`, strict referrer policy. CSV/XLSX exports neutralize formula injection.

---

## 6. Development

```bash
npm run dev          # dev server
npm run typecheck    # next typegen + tsc
npm run lint         # eslint (React Compiler rules)
npm run build        # production build
npm run db:types     # regenerate types/database.ts from a migrated database (see script header)
```

### Database tests (no Docker needed)

`supabase/tests/run.sh` creates a throwaway database on any PostgreSQL 15+ server. It applies a minimal Supabase stub, all migrations and the seed, then runs 76 checks:

- **RLS and privileges:** anonymous access, role isolation, faculty cannot see evaluator identities, role-escalation attempts.
- **Business rules:** enrollment, open window, duplicate and late submissions, edits after submission.
- **Imports:** atomic rollback, duplicates are preserved.
- **Analytics:** results match direct counts.
- **Other:** historical snapshot integrity, anonymity threshold, notifications, soft delete.

```bash
DATABASE_ADMIN_URL=postgresql://postgres@127.0.0.1:5432/postgres ./supabase/tests/run.sh
```

Never point it at a real project.

### Import file formats

Templates are in `public/templates/`. They can also be downloaded from the import pages.

- **Course file:** one row per enrolled student, with Subject Code, Subject Title, Faculty ID, Program, Department (optional), Student ID, School Year, Semester and Section.
- **Evaluation file:** one row per answered question, with Student ID, Subject Code, Faculty ID, School Year, Semester, Section, Question (title or exact text), Rating, Comment and Submitted At.
# asscat-irate
