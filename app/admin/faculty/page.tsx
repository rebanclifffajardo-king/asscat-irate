import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDepartments, getPrograms } from "@/lib/data/lookups";
import { listQuery, likePattern, readParams } from "@/lib/url";
import { publicStorageUrl } from "@/lib/storage";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { FilterSelect } from "@/components/ui/filter-select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FacultyAvatar } from "@/components/ui/faculty-avatar";
import { AddFacultyButton, FacultyRowActions } from "@/components/admin/people/faculty-form";

export const metadata: Metadata = { title: "Faculty" };

function serviceLabel(years: number | null) {
  if (years === null) return "—";
  if (years < 1) return "Less than 1 year";
  return `${years} year${years === 1 ? "" : "s"}`;
}

export default async function FacultyPage({ searchParams }: PageProps<"/admin/faculty">) {
  const params = await readParams(searchParams);
  const lq = listQuery(params, { sortable: ["faculty_number", "sort_name", "email", "program_code", "department_code", "years_of_service"], defaultSort: "sort_name" });
  const supabase = await createClient();
  let q = supabase.from("faculty_overview").select("*", { count: "exact" });
  if (lq.q) q = q.ilike("search_text", likePattern(lq.q));
  if (params.program) q = q.eq("program_id", params.program);
  if (params.department) q = q.eq("department_id", params.department);
  if (params.status === "active") q = q.eq("is_active", true);
  if (params.status === "inactive") q = q.eq("is_active", false);

  const [{ data, count }, programs, departments] = await Promise.all([
    q.order(lq.sort, { ascending: lq.dir === "asc", nullsFirst: false }).order("faculty_number").range(lq.from, lq.to),
    getPrograms(),
    getDepartments(),
  ]);

  type Row = NonNullable<typeof data>[number];
  const columns: Column<Row>[] = [
    { key: "id", header: "Faculty ID", sortKey: "faculty_number", className: "whitespace-nowrap font-mono text-[13px]", cell: (r) => r.faculty_number },
    { key: "photo", header: "Photo", hideOnMobile: true, cell: (r) => <FacultyAvatar name={r.full_name ?? ""} src={publicStorageUrl("faculty-photos", r.photo_path)} size="sm" /> },
    { key: "name", header: "Faculty Name", sortKey: "sort_name", primary: true, cell: (r) => (
      <Link href={`/admin/faculty/${r.id}`} className="flex items-center gap-2 hover:text-brand-600">
        <span className="md:hidden"><FacultyAvatar name={r.full_name ?? ""} src={publicStorageUrl("faculty-photos", r.photo_path)} size="xs" /></span>
        <span className="font-semibold text-gray-900 hover:text-brand-600">{r.last_name}, {r.first_name}{r.middle_name ? ` ${r.middle_name[0]}.` : ""}</span>
      </Link>
    ) },
    { key: "email", header: "Email", sortKey: "email", cell: (r) => <span className="break-all">{r.email}</span> },
    { key: "program", header: "Program", sortKey: "program_code", cell: (r) => <span title={r.program_name ?? ""}>{r.program_code}</span> },
    { key: "dept", header: "Department", sortKey: "department_code", cell: (r) => <span title={r.department_name ?? ""}>{r.department_code}</span> },
    { key: "service", header: "Years of Service", sortKey: "years_of_service", className: "whitespace-nowrap", cell: (r) => serviceLabel(r.years_of_service) },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.is_active ? "active" : "inactive"} /> },
    { key: "actions", header: "Action", isAction: true, className: "w-16 text-right", cell: (r) => (
      <FacultyRowActions
        faculty={{
          id: r.id!, faculty_number: r.faculty_number!, first_name: r.first_name!, middle_name: r.middle_name, last_name: r.last_name!,
          email: r.email!, birthday: r.birthday, date_started: r.date_started, program_id: r.program_id!,
          photo_url: publicStorageUrl("faculty-photos", r.photo_path), is_active: r.is_active!, full_name: r.full_name!,
        }}
        programs={programs}
      />
    ) },
  ];

  return (
    <>
      <PageHeader title="Faculty" breadcrumbs={[{ label: "Home", href: "/admin/dashboard" }, { label: "Faculty" }]} actions={<AddFacultyButton programs={programs} />} />
      <Card outline="brand">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
          <SearchInput placeholder="Search ID, name, email…" className="sm:col-span-2 lg:w-72" />
          <FilterSelect param="department" label="Department" options={departments.map((d) => ({ value: d.id, label: d.code }))} allLabel="All departments" className="lg:w-44" />
          <FilterSelect param="program" label="Program" options={programs.map((p) => ({ value: p.id, label: p.code }))} allLabel="All programs" className="lg:w-40" />
          <FilterSelect param="status" label="Status" options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} className="lg:w-36" />
        </div>
        <DataTable columns={columns} rows={data ?? []} rowKey={(r) => r.id!} basePath="/admin/faculty" params={params} sort={lq.sort} dir={lq.dir}
          caption="Faculty" empty={<EmptyState title="No faculty found" description="Adjust the filters or add a faculty member." />} />
        <Pagination page={lq.page} pageSize={lq.pageSize} total={count ?? 0} basePath="/admin/faculty" params={params} />
      </Card>
    </>
  );
}
