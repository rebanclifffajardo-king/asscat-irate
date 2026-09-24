import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { FacultyAvatar } from "@/components/ui/faculty-avatar";
import { RatingDisplay } from "@/components/ui/rating-display";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Student" };

export default async function StudentDetailPage({ params }: PageProps<"/admin/students/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: s } = await supabase.from("student_overview").select("*").eq("id", id).maybeSingle();
  if (!s) notFound();

  const [{ data: profile }, { data: enrollments }] = await Promise.all([
    s.profile_id ? supabase.from("profiles").select("last_login_at, must_change_password").eq("id", s.profile_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("enrollment_overview").select("offering_id, evaluation_status, average_rating, submitted_at").eq("student_id", id),
  ]);
  const offeringIds = (enrollments ?? []).map((e) => e.offering_id!);
  const { data: offerings } = offeringIds.length
    ? await supabase.from("offering_overview").select("id, subject_code, subject_title, section, faculty_name, period_label, start_year, semester").in("id", offeringIds)
    : { data: [] };
  const byId = new Map((offerings ?? []).map((o) => [o.id, o]));
  const rows = (enrollments ?? [])
    .map((e) => ({ ...e, o: byId.get(e.offering_id) }))
    .filter((r) => r.o)
    .sort((a, b) => (b.o!.start_year! - a.o!.start_year!) || (b.o!.semester! - a.o!.semester!) || a.o!.subject_code!.localeCompare(b.o!.subject_code!));

  const info: [string, React.ReactNode][] = [
    ["Student ID", <span key="id" className="font-mono">{s.student_number}</span>],
    ["Email", s.email],
    ["Program", `${s.program_code} – ${s.program_name}`],
    ["Department", s.department_name],
    ["Year Level", s.year_level_name],
    ["Status", <StatusBadge key="st" status={s.is_active ? "active" : "inactive"} />],
    ["Last Login", formatDateTime(profile?.last_login_at)],
  ];

  return (
    <>
      <PageHeader title={s.full_name ?? "Student"} breadcrumbs={[{ label: "Home", href: "/admin/dashboard" }, { label: "Students", href: "/admin/students" }, { label: s.student_number ?? "" }]} />
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card outline="brand">
          <CardBody className="flex flex-col items-center text-center">
            <FacultyAvatar name={s.full_name ?? ""} size="xl" className="ring-brand-100" />
            <p className="mt-3 text-lg font-semibold text-gray-900">{s.full_name}</p>
            <p className="text-sm text-gray-500">{s.program_code} · {s.year_level_name}</p>
          </CardBody>
          <dl className="divide-y divide-gray-100 border-t border-gray-100 text-sm">
            {info.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-gray-500">{k}</dt>
                <dd className="text-right font-medium text-gray-800">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <CardHeader title="Enrolled Subjects & Evaluations" description="Across all school years and semesters." />
          {rows.length === 0 ? (
            <EmptyState title="No enrollments" description="This student is not enrolled in any class yet." />
          ) : (
            <ul className="divide-y divide-gray-100">
              {rows.map((r) => (
                <li key={r.offering_id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Link href={`/admin/surveys/${r.offering_id}`} className="font-semibold text-gray-900 hover:text-brand-600">
                      {r.o!.subject_code}{r.o!.section ? ` (${r.o!.section})` : ""} — {r.o!.subject_title}
                    </Link>
                    <p className="text-xs text-gray-500">{r.o!.faculty_name} · {r.o!.period_label}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.evaluation_status === "completed" && <RatingDisplay value={r.average_rating} showLabel={false} />}
                    <StatusBadge status={r.evaluation_status === "in_progress" ? "ongoing" : r.evaluation_status!} />
                    {r.submitted_at && <span className="hidden text-xs text-gray-500 md:inline">{formatDateTime(r.submitted_at)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
