import type { Metadata } from "next";
import Link from "next/link";
import { FileUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/data/lookups";
import { listQuery, likePattern, readParams } from "@/lib/url";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { FilterSelect } from "@/components/ui/filter-select";
import { Badge, StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { AddQuestionButton, QuestionRowActions } from "@/components/admin/questions/question-form";

export const metadata: Metadata = { title: "Questions" };

export default async function QuestionsPage({ searchParams }: PageProps<"/admin/questions">) {
  const params = await readParams(searchParams);
  const lq = listQuery(params, { sortable: ["title", "category_name", "category_sort_order", "sort_order"], defaultSort: "category_sort_order", pageSize: 20 });
  const supabase = await createClient();
  let q = supabase.from("question_overview").select("*", { count: "exact" });
  if (lq.q) q = q.ilike("search_text", likePattern(lq.q));
  if (params.category) q = q.eq("category_id", params.category);
  if (params.status === "active") q = q.eq("is_active", true);
  if (params.status === "inactive") q = q.eq("is_active", false);
  const [{ data, count }, categories] = await Promise.all([
    q.order(lq.sort, { ascending: lq.dir === "asc" }).order("sort_order").order("title").range(lq.from, lq.to),
    getCategories(),
  ]);

  type Row = NonNullable<typeof data>[number];
  const columns: Column<Row>[] = [
    { key: "title", header: "Title", sortKey: "title", primary: true, className: "whitespace-nowrap", cell: (r) => <span className="font-semibold text-gray-900">{r.title}</span> },
    { key: "content", header: "Question", cell: (r) => (
      <span className="block max-w-xl">
        {r.content}
        {!r.is_required && <Badge tone="blue" className="ml-2">Optional</Badge>}
      </span>
    ) },
    { key: "category", header: "Category", sortKey: "category_name", cell: (r) => (
      <span className={r.category_is_active ? "" : "text-gray-400 line-through"}>{r.category_name}</span>
    ) },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.is_active ? "active" : "inactive"} /> },
    { key: "actions", header: "Action", isAction: true, className: "w-16 text-right", cell: (r) => (
      <QuestionRowActions
        question={{ id: r.id!, title: r.title!, content: r.content!, category_id: r.category_id!, sort_order: r.sort_order!, is_required: r.is_required!, is_active: r.is_active!, is_used: !!r.is_used }}
        categories={categories}
      />
    ) },
  ];

  return (
    <>
      <PageHeader
        title="Questions"
        description="Evaluation questions answered by students on the Likert scale. Used questions can be deactivated but not deleted."
        breadcrumbs={[{ label: "Home", href: "/admin/dashboard" }, { label: "Questions" }]}
        actions={<div className="flex flex-wrap gap-2"><Link href="/admin/questions/import" className={buttonClasses("secondary")}><FileUp className="h-4 w-4" /> Import CSV</Link><AddQuestionButton categories={categories} /></div>}
      />
      <Card outline="brand">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <SearchInput placeholder="Search questions…" />
          <FilterSelect param="category" label="Category" options={categories.map((c) => ({ value: c.id, label: c.name }))} allLabel="All categories" className="sm:w-56" />
          <FilterSelect param="status" label="Status" options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} className="sm:w-40" />
        </div>
        <DataTable columns={columns} rows={data ?? []} rowKey={(r) => r.id!} basePath="/admin/questions" params={params} sort={lq.sort} dir={lq.dir}
          caption="Evaluation questions" empty={<EmptyState title="No questions found" description={lq.q || params.category ? "Try changing the filters." : "Add the first evaluation question."} />} />
        <Pagination page={lq.page} pageSize={lq.pageSize} total={count ?? 0} basePath="/admin/questions" params={params} />
      </Card>
    </>
  );
}
