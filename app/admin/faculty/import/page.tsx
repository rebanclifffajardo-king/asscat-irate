import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { ImportWizard } from "@/components/admin/imports/import-wizard";
import { ImportColumnGuide } from "@/components/admin/imports/column-guide";
import { commitFacultyImport, previewFacultyImport } from "../import-actions";

export const metadata: Metadata = { title: "Import Faculty" };

// Creating login accounts takes a moment per row.
export const maxDuration = 300;

const COLUMNS: [string, string][] = [
  ["Faculty ID", "Required, e.g. FAC-0101. Letters, numbers, - _ . only. Matches an existing faculty member → skipped."],
  ["First Name", "Required."],
  ["Middle Name", "Optional."],
  ["Last Name", "Required."],
  ["Email", "Required. Used to sign in. Matches an existing faculty member → skipped."],
  ["Birthday", "Optional date, e.g. 1985-06-15 (YYYY-MM-DD) or 6/15/1985. Must be in the past."],
  ["Date Started", "Optional date; after the birthday and not in the future."],
  ["Program", "Required active program code, e.g. BSIT. The department follows the program."],
];

export default function ImportFacultyPage() {
  return (
    <>
      <PageHeader
        title="Import Faculty"
        description="Adds faculty records with login accounts. One row per faculty member."
        breadcrumbs={[{ label: "Home", href: "/admin/dashboard" }, { label: "Faculty", href: "/admin/faculty" }, { label: "Import CSV" }]}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <ImportWizard
          partial
          preview={previewFacultyImport}
          commit={commitFacultyImport}
          templateHref="/templates/faculty-import-template.csv"
          doneHref="/admin/faculty"
          doneLabel="Go to Faculty"
          columns={[
            { key: "faculty_number", label: "Faculty ID" },
            { key: "first_name", label: "First Name" },
            { key: "middle_name", label: "Middle Name" },
            { key: "last_name", label: "Last Name" },
            { key: "email", label: "Email" },
            { key: "birthday", label: "Birthday" },
            { key: "date_started", label: "Date Started" },
            { key: "program", label: "Program" },
          ]}
          summaryLabels={{ total: "Rows", add: "Will be added", exists: "Already exist (skipped)", invalid: "Invalid" }}
          resultLabels={{ added: "Added", skipped: "Skipped", failed: "Failed", total: "Rows" }}
          confirmNote="A login account with a temporary password is created for each new faculty member. The passwords are shown once on the next screen. Photos can be added later from each faculty record."
          credentialColumns={[{ key: "faculty_number", label: "Faculty ID" }, { key: "first_name", label: "First Name" }, { key: "last_name", label: "Last Name" }, { key: "email", label: "Email" }]}
          credentialFileName="faculty-temporary-passwords.csv"
        />
        <ImportColumnGuide columns={COLUMNS} footer="Rows that already exist, or repeat an earlier row of the same file, are skipped. Invalid rows are reported and not imported." />
      </div>
    </>
  );
}
