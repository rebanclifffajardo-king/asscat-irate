import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { ImportWizard } from "@/components/admin/imports/import-wizard";
import { ImportColumnGuide } from "@/components/admin/imports/column-guide";
import { commitCourseImport, previewCourseImport } from "../import-actions";

export const metadata: Metadata = { title: "Import Course File" };

const COLUMNS: [string, string][] = [
  ["Course Number", "Required. Created automatically if new."],
  ["Descriptive Title", "Required."],
  ["Faculty ID", "Required. Must already exist."],
  ["Program", "Required program code (e.g. BSIT). Must exist."],
  ["Department", "Optional department code; must match the program's department."],
  ["Student ID", "Required. Must already exist."],
  ["School Year", "Required, e.g. 2026-2027. A survey schedule must exist."],
  ["Semester", "Required: 1st or 2nd."],
  ["Section", "Optional, e.g. A."],
];

export default function ImportCoursePage() {
  return (
    <>
      <PageHeader
        title="Import Course File"
        description="Creates subjects, classes (subject + instructor + semester + section) and student enrollments. One row per enrolled student."
        breadcrumbs={[{ label: "Home", href: "/admin/dashboard" }, { label: "Survey", href: "/admin/surveys" }, { label: "Import Course File" }]}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <ImportWizard
          preview={previewCourseImport}
          commit={commitCourseImport}
          templateHref="/templates/course-import-template.csv"
          doneHref="/admin/surveys"
          columns={[
            { key: "subject_code", label: "Course Number" }, { key: "subject_title", label: "Descriptive Title" },
            { key: "faculty_id", label: "Faculty ID" }, { key: "program", label: "Program" }, { key: "department", label: "Department" },
            { key: "student_id", label: "Student ID" }, { key: "school_year", label: "School Year" }, { key: "semester", label: "Semester" },
            { key: "section", label: "Section" },
          ]}
          summaryLabels={{ total: "Rows", valid: "Valid", errors: "Errors", warnings: "Warnings", newSubjects: "New subjects", newClasses: "New classes", newEnrollments: "New enrollments", alreadyEnrolled: "Already enrolled" }}
          resultLabels={{ subjects_created: "Subjects created", offerings_created: "Classes created", enrollments_created: "Enrollments created", enrollments_existing: "Already enrolled" }}
        />
        <ImportColumnGuide columns={COLUMNS} />
      </div>
    </>
  );
}
