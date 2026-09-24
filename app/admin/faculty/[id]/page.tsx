import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicStorageUrl } from "@/lib/storage";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { FacultyAvatar } from "@/components/ui/faculty-avatar";
import { RatingDisplay } from "@/components/ui/rating-display";
import { EvaluationProgress } from "@/components/ui/evaluation-progress";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Faculty" };

export default async function FacultyDetailPage({ params }: PageProps<"/admin/faculty/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: f } = await supabase.from("faculty_overview").select("*").eq("id", id).maybeSingle();
  if (!f) notFound();
  const [{ data: offerings }, { data: profile }] = await Promise.all([
    supabase.from("offering_overview").select("*").eq("faculty_id", id).order("start_year", { ascending: false }).order("semester", { ascending: false }).order("subject_code"),
    f.profile_id ? supabase.from("profiles").select("last_login_at").eq("id", f.profile_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const info: [string, React.ReactNode][] = [
    ["Faculty ID", <span key="id" className="font-mono">{f.faculty_number}</span>],
    ["Email", f.email],
    ["Program", `${f.program_code} – ${f.program_name}`],
    ["Department", `${f.department_code} – ${f.department_name}`],
    ["Birthday", f.birthday ? `${formatDate(f.birthday)} (age ${f.age})` : "—"],
    ["Date Started", f.date_started ? `${formatDate(f.date_started)} (${f.years_of_service} yr${f.years_of_service === 1 ? "" : "s"})` : "—"],
    ["Status", <StatusBadge key="st" status={f.is_active ? "active" : "inactive"} />],
    ["Last Login", formatDateTime(profile?.last_login_at)],
  ];

  return (
    <>
      <PageHeader title={f.full_name ?? "Faculty"} breadcrumbs={[{ label: "Home", href: "/admin/dashboard" }, { label: "Faculty", href: "/admin/faculty" }, { label: f.faculty_number ?? "" }]} />
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card outline="brand">
          <CardBody className="flex flex-col items-center text-center">
            <FacultyAvatar name={f.full_name ?? ""} src={publicStorageUrl("faculty-photos", f.photo_path)} size="xl" className="ring-brand-100" />
            <p className="mt-3 text-lg font-semibold text-gray-900">{f.full_name}</p>
            <p className="text-sm text-gray-500">{f.department_name}</p>
          </CardBody>
          <dl className="divide-y divide-gray-100 border-t border-gray-100 text-sm">
            {info.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="shrink-0 text-gray-500">{k}</dt>
                <dd className="text-right font-medium text-gray-800">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <CardHeader title="Classes Handled" description="Evaluation progress and average rating per class." />
          {!offerings?.length ? (
            <EmptyState title="No classes assigned" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {offerings.map((o) => (
                <li key={o.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_180px_180px] sm:items-center">
                  <div className="min-w-0">
                    <Link href={`/admin/surveys/${o.id}`} className="font-semibold text-gray-900 hover:text-brand-600">
                      {o.subject_code}{o.section ? ` (${o.section})` : ""} — {o.subject_title}
                    </Link>
                    <p className="text-xs text-gray-500">{o.period_label} · {o.program_code}</p>
                  </div>
                  <EvaluationProgress completed={o.completed_count ?? 0} total={o.enrolled_count ?? 0} compact />
                  <RatingDisplay value={o.average_rating} showLabel={false} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
