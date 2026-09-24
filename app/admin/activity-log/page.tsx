import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listQuery, likePattern, readParams } from "@/lib/url";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABEL, isAppRole } from "@/lib/auth/roles";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { FilterSelect } from "@/components/ui/filter-select";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { Badge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Activity Log" };

const MODULES = ["Authentication", "Dashboard", "Survey", "Questions", "Categories", "Students", "Faculty", "Subjects", "Reports", "Settings", "Evaluation", "Import", "Profile", "System"];

/** Short, non-identifying device summary from the user agent. */
function device(ua: string | null): string {
  if (!ua) return "—";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Other";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Other";
  return `${browser} · ${os}`;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export default async function ActivityLogPage({ searchParams }: PageProps<"/admin/activity-log">) {
  const params = await readParams(searchParams);
  const lq = listQuery(params, { sortable: ["created_at", "user_name", "module", "action"], defaultSort: "created_at", defaultDir: "desc", pageSize: 25 });
  const supabase = await createClient();
  let q = supabase.from("activity_log_overview").select("*", { count: "exact" });
  if (lq.q) q = q.ilike("search_text", likePattern(lq.q));
  if (params.user) q = q.ilike("user_name", likePattern(params.user.toLowerCase().replace(/[^\p{L}\p{N}\s.\-]/gu, " ").trim()));
  if (params.role && isAppRole(params.role)) q = q.eq("role", params.role);
  if (params.module && MODULES.includes(params.module)) q = q.eq("module", params.module);
  if (params.from && DAY.test(params.from)) q = q.gte("created_at", `${params.from}T00:00:00+08:00`);
  if (params.to && DAY.test(params.to)) q = q.lte("created_at", `${params.to}T23:59:59.999+08:00`);
  const { data, count } = await q.order(lq.sort, { ascending: lq.dir === "asc" }).order("id", { ascending: false }).range(lq.from, lq.to);

  type Row = NonNullable<typeof data>[number];
  const roleTone = { admin: "teal", faculty: "blue", student: "green" } as const;
  const columns: Column<Row>[] = [
    { key: "at", header: "Date/Time", sortKey: "created_at", className: "whitespace-nowrap text-[13px]", cell: (r) => formatDateTime(r.created_at) },
    { key: "user", header: "User", sortKey: "user_name", primary: true, cell: (r) => <span className="font-semibold text-gray-900">{r.user_name ?? "System"}</span> },
    { key: "role", header: "Role", cell: (r) => (r.role ? <Badge tone={roleTone[r.role]}>{ROLE_LABEL[r.role]}</Badge> : "—") },
    { key: "action", header: "Activity", sortKey: "action", cell: (r) => r.action },
    { key: "module", header: "Module", sortKey: "module", cell: (r) => <Badge tone="gray">{r.module}</Badge> },
    { key: "desc", header: "Description", cell: (r) => <span className="line-clamp-2 max-w-md text-gray-600" title={r.description ?? ""}>{r.description ?? "—"}</span> },
    { key: "ip", header: "IP Address", hideOnMobile: true, className: "whitespace-nowrap font-mono text-xs", cell: (r) => r.ip_address ?? "—" },
    { key: "device", header: "Device", hideOnMobile: true, className: "whitespace-nowrap text-xs", cell: (r) => <span title={r.user_agent ?? ""}>{device(r.user_agent)}</span> },
  ];

  return (
    <>
      <PageHeader title="Activity Log" description="Append-only audit trail of important actions. Entries cannot be edited or deleted."
        breadcrumbs={[{ label: "Home", href: "/admin/dashboard" }, { label: "Activity Log" }]} />
      <Card outline="brand">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 xl:items-end">
          <SearchInput placeholder="Search activity…" className="sm:col-span-2 lg:col-span-1 xl:w-auto" />
          <SearchInput placeholder="Filter by user…" param="user" className="xl:w-auto" />
          <FilterSelect param="role" label="Role" options={[{ value: "admin", label: "Administrator" }, { value: "faculty", label: "Faculty" }, { value: "student", label: "Student" }]} allLabel="All roles" />
          <FilterSelect param="module" label="Module" options={MODULES.map((m) => ({ value: m, label: m }))} allLabel="All modules" />
          <DateRangeFilter />
        </div>
        <DataTable columns={columns} rows={data ?? []} rowKey={(r) => String(r.id)} basePath="/admin/activity-log" params={params} sort={lq.sort} dir={lq.dir}
          caption="Activity log" empty={<EmptyState title="No activity found" description="Try widening the filters." />} />
        <Pagination page={lq.page} pageSize={lq.pageSize} total={count ?? 0} basePath="/admin/activity-log" params={params} />
      </Card>
    </>
  );
}
