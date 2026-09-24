import type { Metadata } from "next";
import Link from "next/link";
import { FileUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPrograms, getYearLevels } from "@/lib/data/lookups";
import { listQuery, likePattern, readParams } from "@/lib/url";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { FilterSelect } from "@/components/ui/filter-select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { BulkDeleteStudentsButton } from "@/components/admin/bulk-actions";
import { buttonClasses } from "@/components/ui/button";
import { AddStudentButton, StudentLink, StudentRowActions } from "@/components/admin/people/student-form";

export const metadata: Metadata = { title: "Students" };

export default async function StudentsPage({ searchParams }: PageProps<"/admin/students">) {
  const params = await readParams(searchParams);
  const lq = listQuery(params, { sortable: ["student_number", "sort_name", "email", "program_code", "year_level_order"], defaultSort: "sort_name" });
  const supabase = await createClient();
  let q = supabase.from("student_overview").select("*", { count: "exact" });
  if (lq.q) q = q.ilike("search_text", likePattern(lq.q));
  if (params.program) q = q.eq("program_id", params.program);
  if (params.year) q = q.eq("year_level_id", params.year);
  if (params.status === "active") q = q.eq("is_active", true);
  if (params.status === "inactive") q = q.eq("is_active", false);

  const [{ data, count }, programs, yearLevels] = await Promise.all([
    q.order(lq.sort, { ascending: lq.dir === "asc" }).order("student_number").range(lq.from, lq.to),
    getPrograms(),
    getYearLevels(),
  ]);
  const programOpts = programs.map((p) => ({ id: p.id, code: p.code, name: p.name, is_active: p.is_active }));

  type Row = NonNullable<typeof data>[number];
  const columns: Column<Row>[] = [
    { key: "id", header: "Student ID", sortKey: "student_number", className: "whitespace-nowrap font-mono text-[13px]", cell: (r) => r.student_number },
    { key: "name", header: "Student Name", sortKey: "sort_name", primary: true, cell: (r) => (
      <StudentLink id={r.id!}><span className="font-semibold text-gray-900">{r.last_name}, {r.first_name}{r.middle_name ? ` ${r.middle_name[0]}.` : ""}</span></StudentLink>
    ) },
    { key: "email", header: "Email", sortKey: "email", cell: (r) => <span className="break-all">{r.email}</span> },
    { key: "program", header: "Program", sortKey: "program_code", cell: (r) => <span title={r.program_name ?? ""}>{r.program_code}</span> },
    { key: "year", header: "Year Level", sortKey: "year_level_order", className: "whitespace-nowrap", cell: (r) => r.year_level_name },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.is_active ? "active" : "inactive"} /> },
    { key: "actions", header: "Action", isAction: true, className: "w-16 text-right", cell: (r) => (
      <StudentRowActions
        student={{
          id: r.id!, student_number: r.student_number!, first_name: r.first_name!, middle_name: r.middle_name, last_name: r.last_name!,
          email: r.email!, program_id: r.program_id!, year_level_id: r.year_level_id!, is_active: r.is_active!, full_name: r.full_name!,
        }}
        programs={programOpts}
        yearLevels={yearLevels}
      />
    ) },
  ];

  return (
    <>
      <PageHeader
        title="Students"
        breadcrumbs={[{ label: "Home", href: "/admin/dashboard" }, { label: "Students" }]}
        actions={<div className="flex flex-wrap gap-2"><Link href="/admin/students/import" className={buttonClasses("secondary")}><FileUp className="h-4 w-4" /> Import CSV</Link><AddStudentButton programs={programOpts} yearLevels={yearLevels} /></div>}
      />
      <Card outline="brand">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
          <SearchInput placeholder="Search ID, name, email…" className="sm:col-span-2 lg:w-72" />
          <FilterSelect param="program" label="Program" options={programs.map((p) => ({ value: p.id, label: p.code }))} allLabel="All programs" className="lg:w-44" />
          <FilterSelect param="year" label="Year Level" options={yearLevels.map((y) => ({ value: y.id, label: y.name }))} allLabel="All year levels" className="lg:w-40" />
          <FilterSelect param="status" label="Status" options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} className="lg:w-36" />
        </div>
        <DataTable columns={columns} rows={data ?? []} rowKey={(r) => r.id!} basePath="/admin/students" params={params} sort={lq.sort} dir={lq.dir}
          caption="Students"
          selection={{ rowLabel: (r) => `${r.last_name}, ${r.first_name} (${r.student_number})`, actions: <BulkDeleteStudentsButton /> }}
          empty={<EmptyState title="No students found" description="Adjust the filters or add a student." />} />
        <Pagination page={lq.page} pageSize={lq.pageSize} total={count ?? 0} basePath="/admin/students" params={params} />
      </Card>
    </>
  );
}
