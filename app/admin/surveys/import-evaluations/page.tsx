import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ImportWizard } from "@/components/admin/imports/import-wizard";
import { commitEvaluationImport, previewEvaluationImport } from "../import-actions";

export const metadata: Metadata = { title: "Import Evaluation File" };

const COLUMNS = [
  ["Student ID", "Required. Must exist."],
  ["Subject Code / Faculty ID", "Required. The class must exist (import the course file first)."],
  ["School Year / Semester / Section", "Identify the class, e.g. 2025-2026, 1st, A."],
  ["Question", "Required. Question title (e.g. TC-1) or the exact question text."],
  ["Rating", "Required whole number on the configured scale."],
  ["Comment", "Optional. One comment per student per class."],
  ["Submitted At", "Optional date/time, e.g. 2025-11-20 09:15."],
];

export default function ImportEvaluationsPage() {
  return (
    <>
      <PageHeader
        title="Import Evaluation File"
        description="Imports historical evaluations. One row per answered question."
        breadcrumbs={[{ label: "Home", href: "/admin/dashboard" }, { label: "Survey", href: "/admin/surveys" }, { label: "Import Evaluation File" }]}
      />
      <Alert tone="info" className="mb-5">
        Existing evaluations are never overwritten: if a student already has an evaluation for a class, the imported rows for that
        class are skipped and reported. Imported answers store a snapshot of the question text.
      </Alert>
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <ImportWizard
          preview={previewEvaluationImport}
          commit={commitEvaluationImport}
          templateHref="/templates/evaluation-import-template.csv"
          doneHref="/admin/surveys"
          columns={[
            { key: "student_id", label: "Student ID" }, { key: "subject_code", label: "Subject Code" }, { key: "faculty_id", label: "Faculty ID" },
            { key: "school_year", label: "School Year" }, { key: "semester", label: "Semester" }, { key: "section", label: "Section" },
            { key: "question", label: "Question" }, { key: "rating", label: "Rating" }, { key: "comment", label: "Comment" }, { key: "submitted_at", label: "Submitted At" },
          ]}
          summaryLabels={{ total: "Rows", valid: "Valid", errors: "Errors", warnings: "Warnings", evaluations: "New evaluations", skippedExisting: "Existing (skipped)", incomplete: "Missing required answers" }}
          resultLabels={{ evaluations_created: "Evaluations created", evaluations_skipped: "Skipped (existing)", enrollments_created: "Enrollments created" }}
        />
        <Card className="self-start">
          <CardHeader title="Expected columns" />
          <CardBody>
            <dl className="space-y-2 text-sm">
              {COLUMNS.map(([c, d]) => (
                <div key={c}><dt className="font-semibold text-gray-800">{c}</dt><dd className="text-gray-600">{d}</dd></div>
              ))}
            </dl>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
