import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CheckCircle2, ClipboardList, Clock } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { readParams } from "@/lib/url";
import { publicStorageUrl } from "@/lib/storage";
import { formatDateTime, periodWindow } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { AnalyticsCard } from "@/components/ui/stat-card";
import { FacultyAvatar } from "@/components/ui/faculty-avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { SemesterSelector } from "@/components/ui/semester-selector";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "My Evaluations" };

type Row = {
  offering_id: string; subject_code: string; subject_title: string; section: string; faculty_name: string; faculty_photo_path: string | null;
  period_id: string; period_label: string; open_at: string; close_at: string; status: string; started_at: string | null; submitted_at: string | null;
};

const ACTION: Record<string, { label: string; variant: "primary" | "secondary" | "warning" }> = {
  not_started: { label: "Evaluate", variant: "primary" },
  in_progress: { label: "Continue", variant: "warning" },
  completed: { label: "View", variant: "secondary" },
};

export default async function StudentDashboard({ searchParams }: PageProps<"/student/dashboard">) {
  const user = await requireRole("student");
  const params = await readParams(searchParams);
  const supabase = await createClient();
  const [{ data: periods }, { data: current }] = await Promise.all([
    supabase.rpc("get_student_periods"),
    supabase.from("academic_periods").select("id, label, open_at, close_at").eq("is_current", true).maybeSingle(),
  ]);
  const periodList = (periods ?? []).map((p) => ({ id: p.id, label: p.label, is_current: p.is_current }));
  // Offer the current period even when the student has no classes in it yet.
  if (current && !periodList.some((p) => p.id === current.id)) periodList.unshift({ id: current.id, label: current.label ?? "", is_current: true });
  const periodId = periodList.some((p) => p.id === params.period) ? params.period : current?.id ?? periodList[0]?.id;
  const { data } = periodId ? await supabase.rpc("get_student_evaluations", { p_period_id: periodId }) : { data: [] };
  const rows = (data ?? []) as Row[];
  const done = rows.filter((r) => r.status === "completed");
  const todo = rows.filter((r) => r.status !== "completed");
  const period = rows[0] ?? null;
  const periodMeta = period ?? (current && current.id === periodId ? { period_label: current.label, open_at: current.open_at, close_at: current.close_at } : null);
  const { isOpen, daysLeft } = periodWindow(periodMeta?.open_at, periodMeta?.close_at);

  const card = (r: Row) => {
    const action = ACTION[r.status];
    return (
      <li key={r.offering_id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
        <FacultyAvatar name={r.faculty_name} src={publicStorageUrl("faculty-photos", r.faculty_photo_path)} size="md" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">
            <span className="text-brand-700">{r.subject_code}</span>{r.section ? <span className="text-xs text-gray-500"> ({r.section})</span> : null} — {r.subject_title}
          </p>
          <p className="text-sm text-gray-600">Instructor: {r.faculty_name}</p>
          {r.submitted_at && <p className="text-xs text-gray-500">Submitted {formatDateTime(r.submitted_at)}</p>}
        </div>
        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
          <StatusBadge status={r.status} />
          {action ? (
            <Link href={`/student/evaluate/${r.offering_id}`} className={buttonClasses(action.variant, "sm", "min-w-28")}>{action.label}</Link>
          ) : r.status === "upcoming" ? (
            <span className="text-xs text-gray-500">Opens {formatDateTime(r.open_at)}</span>
          ) : (
            <span className={buttonClasses("secondary", "sm", "pointer-events-none min-w-28 opacity-50")} aria-disabled="true">Evaluation Closed</span>
          )}
        </div>
      </li>
    );
  };

  return (
    <>
      <PageHeader
        title="My Evaluations"
        description={`Welcome, ${user.firstName ?? user.displayName}! Evaluate each instructor for the subjects you are enrolled in.`}
        breadcrumbs={[{ label: "Home" }, { label: "My Evaluations" }]}
        actions={periodId ? <SemesterSelector periods={periodList} value={periodId} /> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AnalyticsCard label="Student" value={<span className="text-base">{user.displayName}</span>} icon={<ClipboardList />} tone="primary" hint={`${user.recordNumber} · ${user.programCode} · ${user.yearLevel}`} />
        <AnalyticsCard label="Evaluation Period" value={<span className="text-base">{periodMeta?.period_label ?? "None"}</span>} icon={<CalendarClock />} tone="info"
          hint={periodMeta ? `${formatDateTime(periodMeta.open_at)} – ${formatDateTime(periodMeta.close_at)}` : undefined} />
        <AnalyticsCard label="Completed" value={`${done.length} / ${rows.length}`} icon={<CheckCircle2 />} tone="brand" progress={rows.length ? (done.length / rows.length) * 100 : 0} />
        <AnalyticsCard label="Remaining" value={todo.length} icon={<Clock />} tone={todo.length ? "warning" : "brand"} hint={isOpen && todo.length ? `${daysLeft} day(s) left` : undefined} />
      </div>

      {isOpen && todo.length > 0 && daysLeft <= 3 && (
        <Alert tone="warning" className="mt-4" title="Deadline approaching">The evaluation closes on {formatDateTime(periodMeta!.close_at)}. Please complete your remaining evaluations.</Alert>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card outline="warning">
          <CardHeader title="Subjects requiring evaluation" description={`${todo.length} remaining`} />
          {todo.length ? <ul className="divide-y divide-gray-100">{todo.map(card)}</ul>
            : <EmptyState icon={<CheckCircle2 />} title={rows.length ? "All done!" : "No subjects to evaluate"} description={rows.length ? "You have evaluated all your instructors for this semester." : "You are not enrolled in any subject for this period."} />}
        </Card>
        <Card outline="brand">
          <CardHeader title="Completed evaluations" description={`${done.length} submitted`} />
          {done.length ? <ul className="divide-y divide-gray-100">{done.map(card)}</ul>
            : <EmptyState title="No completed evaluations yet" />}
        </Card>
      </div>
    </>
  );
}
