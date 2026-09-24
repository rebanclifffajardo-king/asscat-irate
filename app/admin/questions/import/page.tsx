import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { ImportWizard } from "@/components/admin/imports/import-wizard";
import { ImportColumnGuide } from "@/components/admin/imports/column-guide";
import { commitQuestionImport, previewQuestionImport } from "../import-actions";

export const metadata: Metadata = { title: "Import Questions" };

const COLUMNS: [string, string][] = [
  ["Category", "Required. Name of an existing, active category, e.g. Teaching Competence."],
  ["Question Title", "Required short code, e.g. TC-5. A title already used in the same category → skipped."],
  ["Question Content", "Required question text (max 1000 characters)."],
  ["Display Order", "Optional whole number 0–1000 (default 0)."],
  ["Required", "Optional Yes or No (default Yes)."],
  ["Active", "Optional Yes or No (default Yes)."],
];

export default function ImportQuestionsPage() {
  return (
    <>
      <PageHeader
        title="Import Questions"
        description="Adds evaluation questions to existing categories. One row per question."
        breadcrumbs={[{ label: "Home", href: "/admin/dashboard" }, { label: "Questions", href: "/admin/questions" }, { label: "Import CSV" }]}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <ImportWizard
          partial
          preview={previewQuestionImport}
          commit={commitQuestionImport}
          templateHref="/templates/question-import-template.csv"
          doneHref="/admin/questions"
          doneLabel="Go to Questions"
          columns={[
            { key: "category", label: "Category" },
            { key: "title", label: "Question Title" },
            { key: "content", label: "Question Content" },
            { key: "sort_order", label: "Display Order" },
            { key: "is_required", label: "Required" },
            { key: "is_active", label: "Active" },
          ]}
          summaryLabels={{ total: "Rows", add: "Will be added", exists: "Already exist (skipped)", invalid: "Invalid" }}
          resultLabels={{ added: "Added", skipped: "Skipped", failed: "Failed", total: "Rows" }}
        />
        <ImportColumnGuide columns={COLUMNS} footer="Rows that already exist, or repeat an earlier row of the same file, are skipped. Invalid rows are reported and not imported." />
      </div>
    </>
  );
}
