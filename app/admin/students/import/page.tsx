import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { ImportWizard } from "@/components/admin/imports/import-wizard";
import { ImportColumnGuide } from "@/components/admin/imports/column-guide";
import { commitStudentImport, previewStudentImport } from "../import-actions";

export const metadata: Metadata = { title: "Import Students" };

// Creating login accounts takes a moment per row.
export const maxDuration = 300;

const COLUMNS: [string, string][] = [
  ["Student ID", "Required, e.g. 2026-0101. Letters, numbers, - _ . only. Matches an existing student → skipped."],
  ["First Name", "Required."],
  ["Middle Name", "Optional."],
  ["Last Name", "Required."],
  ["Email", "Required. Used to sign in. Matches an existing student → skipped."],
  ["Program", "Required active program code, e.g. BSIT."],
  ["Year Level", "Required, e.g. 1st Year (or 1–4)."],
];

export default function ImportStudentsPage() {
  return (
    <>
      <PageHeader
        title="Import Students"
        description="Adds student records with login accounts. One row per student."
        breadcrumbs={[{ label: "Home", href: "/admin/dashboard" }, { label: "Students", href: "/admin/students" }, { label: "Import CSV" }]}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <ImportWizard
          partial
          preview={previewStudentImport}
          commit={commitStudentImport}
          templateHref="/templates/student-import-template.csv"
          doneHref="/admin/students"
          doneLabel="Go to Students"
          columns={[
            { key: "student_number", label: "Student ID" },
            { key: "first_name", label: "First Name" },
            { key: "middle_name", label: "Middle Name" },
            { key: "last_name", label: "Last Name" },
            { key: "email", label: "Email" },
            { key: "program", label: "Program" },
            { key: "year_level", label: "Year Level" },
          ]}
          summaryLabels={{ total: "Rows", add: "Will be added", exists: "Already exist (skipped)", invalid: "Invalid" }}
          resultLabels={{ added: "Added", skipped: "Skipped", failed: "Failed", total: "Rows" }}
          confirmNote="A login account with a temporary password is created for each new student. The passwords are shown once on the next screen."
          credentialColumns={[{ key: "student_number", label: "Student ID" }, { key: "first_name", label: "First Name" }, { key: "last_name", label: "Last Name" }, { key: "email", label: "Email" }]}
          credentialFileName="student-temporary-passwords.csv"
        />
        <ImportColumnGuide columns={COLUMNS} footer="Rows that already exist, or repeat an earlier row of the same file, are skipped. Invalid rows are reported and not imported." />
      </div>
    </>
  );
}
