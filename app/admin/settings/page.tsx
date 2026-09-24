import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getDepartments, getPeriods, getSettings } from "@/lib/data/lookups";
import { listQuery, likePattern, readParams } from "@/lib/url";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/link-tabs";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { AddDepartmentButton, DepartmentRowActions } from "@/components/admin/settings/department-form";
import { AddProgramButton, ProgramRowActions } from "@/components/admin/settings/program-form";
import { AddYearLevelButton, YearLevelRowActions } from "@/components/admin/settings/year-level-form";
import { AddPeriodButton, PeriodRowActions, type PeriodItem } from "@/components/admin/settings/period-form";
import { EvaluationSettingsForm } from "@/components/admin/settings/evaluation-settings-form";
import { SystemSettingsForm } from "@/components/admin/settings/system-settings-form";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  { id: "programs", label: "Programs" },
  { id: "departments", label: "Departments" },
  { id: "year-levels", label: "Year Levels" },
  { id: "schedule", label: "Survey Schedule" },
  { id: "evaluation", label: "Evaluation Settings" },
  { id: "system", label: "System Settings" },
];

export default async function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  const params = await readParams(searchParams);
  const tab = TABS.some((t) => t.id === params.tab) ? params.tab : "programs";

  return (
    <>
      <PageHeader title="Settings" breadcrumbs={[{ label: "Home", href: "/admin/dashboard" }, { label: "Settings" }]} />
      <Card>
        <div className="px-4 pt-2"><LinkTabs tabs={TABS} active={tab} basePath="/admin/settings" /></div>
        {tab === "programs" && <ProgramsTab params={params} />}
        {tab === "departments" && <DepartmentsTab params={params} />}
        {tab === "year-levels" && <YearLevelsTab />}
        {tab === "schedule" && <ScheduleTab />}
        {tab === "evaluation" && <EvaluationTab />}
        {tab === "system" && <SystemTab />}
      </Card>
    </>
  );
}

async function ProgramsTab({ params }: { params: Record<string, string> }) {
  const lq = listQuery(params, { sortable: ["code", "name", "department_code"], defaultSort: "code" });
  const supabase = await createClient();
  let q = supabase.from("program_overview").select("*", { count: "exact" });
  if (lq.q) q = q.ilike("search_text", likePattern(lq.q));
  const [{ data, count }, departments] = await Promise.all([
    q.order(lq.sort, { ascending: lq.dir === "asc" }).range(lq.from, lq.to),
    getDepartments(),
  ]);
  type Row = NonNullable<typeof data>[number];
  const columns: Column<Row>[] = [
    { key: "code", header: "Program Code", sortKey: "code", primary: true, cell: (r) => <span className="font-semibold text-gray-900">{r.code}</span> },
    { key: "name", header: "Program", sortKey: "name", cell: (r) => r.name },
    { key: "dept", header: "Department", sortKey: "department_code", cell: (r) => <span title={r.department_name ?? ""}>{r.department_code}</span> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.is_active ? "active" : "inactive"} /> },
    { key: "actions", header: "Action", isAction: true, className: "w-16 text-right", cell: (r) => (
      <ProgramRowActions program={{ id: r.id!, code: r.code!, name: r.name!, department_id: r.department_id!, is_active: r.is_active! }} departments={departments} />
    ) },
  ];
  return (
    <>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput placeholder="Search programs…" />
        <AddProgramButton departments={departments} />
      </div>
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(r) => r.id!}
        basePath="/admin/settings"
        params={params}
        sort={lq.sort}
        dir={lq.dir}
        caption="Programs"
        empty={<EmptyState title="No programs found" description={lq.q ? "Try a different search." : "Add your first program."} />}
      />
      <p className="px-4 py-3 text-sm text-gray-500">{count ?? 0} program(s)</p>
    </>
  );
}

async function DepartmentsTab({ params }: { params: Record<string, string> }) {
  const lq = listQuery(params, { sortable: ["code", "name", "program_count"], defaultSort: "code" });
  const supabase = await createClient();
  let q = supabase.from("department_overview").select("*", { count: "exact" });
  if (lq.q) q = q.ilike("search_text", likePattern(lq.q));
  const { data, count } = await q.order(lq.sort, { ascending: lq.dir === "asc" }).range(lq.from, lq.to);
  type Row = NonNullable<typeof data>[number];
  const columns: Column<Row>[] = [
    { key: "code", header: "Department Code", sortKey: "code", primary: true, cell: (r) => <span className="font-semibold text-gray-900">{r.code}</span> },
    { key: "name", header: "Department Name", sortKey: "name", cell: (r) => r.name },
    { key: "programs", header: "Number of Programs", sortKey: "program_count", className: "text-center", cell: (r) => r.program_count },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.is_active ? "active" : "inactive"} /> },
    { key: "actions", header: "Action", isAction: true, className: "w-16 text-right", cell: (r) => (
      <DepartmentRowActions dept={{ id: r.id!, code: r.code!, name: r.name!, is_active: r.is_active! }} />
    ) },
  ];
  return (
    <>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput placeholder="Search departments…" />
        <AddDepartmentButton />
      </div>
      <DataTable columns={columns} rows={data ?? []} rowKey={(r) => r.id!} basePath="/admin/settings" params={params} sort={lq.sort} dir={lq.dir}
        caption="Departments" empty={<EmptyState title="No departments found" />} />
      <p className="px-4 py-3 text-sm text-gray-500">{count ?? 0} department(s)</p>
    </>
  );
}

async function YearLevelsTab() {
  const supabase = await createClient();
  const { data } = await supabase.from("year_levels").select("*").order("sort_order");
  const rows = data ?? [];
  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    { key: "name", header: "Name", primary: true, cell: (r) => <span className="font-semibold text-gray-900">{r.name}</span> },
    { key: "order", header: "Sort Order", className: "text-center", cell: (r) => r.sort_order },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.is_active ? "active" : "inactive"} /> },
    { key: "actions", header: "Action", isAction: true, className: "w-16 text-right", cell: (r) => <YearLevelRowActions level={r} /> },
  ];
  return (
    <>
      <div className="flex justify-end p-4"><AddYearLevelButton nextOrder={(rows.at(-1)?.sort_order ?? 0) + 1} /></div>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} caption="Year levels" empty={<EmptyState title="No year levels yet" />} />
    </>
  );
}

async function ScheduleTab() {
  const [periods, settings] = await Promise.all([getPeriods(), getSettings()]);
  type Row = (typeof periods)[number];
  const columns: Column<Row>[] = [
    { key: "sy", header: "School Year", primary: true, cell: (r) => (
      <span className="flex items-center gap-2 font-semibold text-gray-900">
        S.Y. {r.school_year}{r.is_current && <StatusBadge status="current" label="Active Period" />}
      </span>
    ) },
    { key: "sem", header: "Semester", cell: (r) => (r.semester === 1 ? "1st Semester" : "2nd Semester") },
    { key: "open", header: "Open Date", cell: (r) => formatDateTime(r.open_at) },
    { key: "close", header: "Close Date", cell: (r) => formatDateTime(r.close_at) },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status === "closed" ? "expired" : r.status} label={r.status === "closed" ? "Closed/Expired" : undefined} /> },
    { key: "results", header: "Faculty Results", cell: (r) => {
      const visible = settings.results_visibility === "immediate" || !!r.results_released_at || (settings.results_visibility === "after_close" && r.status === "closed");
      return <StatusBadge status={visible ? "released" : "hidden"} />;
    } },
    { key: "actions", header: "Action", isAction: true, className: "w-16 text-right", cell: (r) => <PeriodRowActions period={r as PeriodItem} visibility={settings.results_visibility} /> },
  ];
  return (
    <>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">Status is determined automatically from the open and close dates. Only one period can be the active (default) period.</p>
        <AddPeriodButton />
      </div>
      <DataTable columns={columns} rows={periods} rowKey={(r) => r.id} caption="Survey schedules"
        empty={<EmptyState title="No survey schedules yet" description="Add a school year and semester to start collecting evaluations." />} />
    </>
  );
}

async function EvaluationTab() {
  const settings = await getSettings();
  return (
    <>
      <CardHeader title="Evaluation Settings" description="Controls the evaluation form and when faculty can see their results." className="border-t border-gray-100" />
      <CardBody><EvaluationSettingsForm settings={settings} /></CardBody>
    </>
  );
}

async function SystemTab() {
  const settings = await getSettings();
  return (
    <>
      <CardHeader title="System Settings" className="border-t border-gray-100" />
      <CardBody className="space-y-4">
        <Alert tone="info">Security-related configuration (authentication providers, email templates, keys) is managed in the Supabase dashboard and Vercel environment variables.</Alert>
        <SystemSettingsForm settings={settings} />
      </CardBody>
    </>
  );
}
