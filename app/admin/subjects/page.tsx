import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listQuery, likePattern, readParams } from "@/lib/url";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AddSubjectButton, SubjectRowActions } from "@/components/admin/survey/subject-form";

export const metadata: Metadata = { title: "Subjects" };

export default async function SubjectsPage({ searchParams }: PageProps<"/admin/subjects">) {
  const params = await readParams(searchParams);
  const lq = listQuery(params, { sortable: ["code", "title", "units"], defaultSort: "code", pageSize: 20 });
  const supabase = await createClient();
  let q = supabase.from("subjects").select("*", { count: "exact" });
  if (lq.q) q = q.or(`code.ilike.${likePattern(lq.q)},title.ilike.${likePattern(lq.q)}`);
  const { data, count } = await q.order(lq.sort, { ascending: lq.dir === "asc" }).range(lq.from, lq.to);
  type Row = NonNullable<typeof data>[number];
  const columns: Column<Row>[] = [
    { key: "code", header: "Course Number", sortKey: "code", className: "whitespace-nowrap", cell: (r) => <span className="font-semibold text-gray-900">{r.code}</span> },
    { key: "title", header: "Descriptive Title", sortKey: "title", primary: true, cell: (r) => r.title },
    { key: "units", header: "Units", sortKey: "units", className: "text-center", cell: (r) => r.units ?? "—" },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.is_active ? "active" : "inactive"} /> },
    { key: "actions", header: "Action", isAction: true, className: "w-16 text-right", cell: (r) => <SubjectRowActions subject={r} /> },
  ];
  return (
    <>
      <PageHeader title="Subjects" description="Subject catalog used when assigning classes to faculty."
        breadcrumbs={[{ label: "Home", href: "/admin/dashboard" }, { label: "Survey", href: "/admin/surveys" }, { label: "Subjects" }]}
        actions={<AddSubjectButton />} />
      <Card outline="brand">
        <div className="p-4"><SearchInput placeholder="Search code or title…" /></div>
        <DataTable columns={columns} rows={data ?? []} rowKey={(r) => r.id} basePath="/admin/subjects" params={params} sort={lq.sort} dir={lq.dir}
          caption="Subjects" empty={<EmptyState title="No subjects found" />} />
        <Pagination page={lq.page} pageSize={lq.pageSize} total={count ?? 0} basePath="/admin/subjects" params={params} />
      </Card>
    </>
  );
}
