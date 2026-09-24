import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listQuery, likePattern, readParams } from "@/lib/url";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { FilterSelect } from "@/components/ui/filter-select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AddCategoryButton, CategoryRowActions } from "@/components/admin/questions/category-form";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage({ searchParams }: PageProps<"/admin/categories">) {
  const params = await readParams(searchParams);
  const lq = listQuery(params, { sortable: ["name", "sort_order", "question_count"], defaultSort: "sort_order" });
  const supabase = await createClient();
  let q = supabase.from("category_overview").select("*", { count: "exact" });
  if (lq.q) q = q.ilike("search_text", likePattern(lq.q));
  if (params.status === "active") q = q.eq("is_active", true);
  if (params.status === "inactive") q = q.eq("is_active", false);
  const [{ data, count }, { data: maxRow }] = await Promise.all([
    q.order(lq.sort, { ascending: lq.dir === "asc" }).order("name").range(lq.from, lq.to),
    supabase.from("question_categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle(),
  ]);

  type Row = NonNullable<typeof data>[number];
  const columns: Column<Row>[] = [
    { key: "name", header: "Category", sortKey: "name", primary: true, cell: (r) => <span className="font-semibold text-gray-900">{r.name}</span> },
    { key: "desc", header: "Description", cell: (r) => <span className="line-clamp-2 max-w-md text-gray-600">{r.description || "—"}</span> },
    { key: "count", header: "Number of Questions", sortKey: "question_count", className: "text-center", cell: (r) => (
      <span title={`${r.active_question_count} active`}>{r.question_count}</span>
    ) },
    { key: "order", header: "Order", sortKey: "sort_order", className: "text-center", hideOnMobile: true, cell: (r) => r.sort_order },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.is_active ? "active" : "inactive"} /> },
    { key: "actions", header: "Action", isAction: true, className: "w-16 text-right", cell: (r) => (
      <CategoryRowActions
        category={{ id: r.id!, name: r.name!, description: r.description, sort_order: r.sort_order!, is_active: r.is_active! }}
        questionCount={r.question_count ?? 0}
      />
    ) },
  ];

  return (
    <>
      <PageHeader
        title="Categories"
        description="Evaluation question categories. Categories are grouped on the student evaluation form in this order."
        breadcrumbs={[{ label: "Home", href: "/admin/dashboard" }, { label: "Categories" }]}
        actions={<AddCategoryButton nextOrder={(maxRow?.sort_order ?? 0) + 1} />}
      />
      <Card outline="brand">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <SearchInput placeholder="Search categories…" />
          <FilterSelect param="status" label="Status" options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} className="sm:w-44" />
        </div>
        <DataTable columns={columns} rows={data ?? []} rowKey={(r) => r.id!} basePath="/admin/categories" params={params} sort={lq.sort} dir={lq.dir}
          caption="Question categories" empty={<EmptyState title="No categories found" description="Create categories such as Teaching Competence or Communication." />} />
        <Pagination page={lq.page} pageSize={lq.pageSize} total={count ?? 0} basePath="/admin/categories" params={params} />
      </Card>
    </>
  );
}
