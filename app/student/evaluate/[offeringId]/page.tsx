import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ShieldCheck } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { publicStorageUrl } from "@/lib/storage";
import { semesterLabel } from "@/lib/format";
import type { EvaluationForm } from "@/lib/evaluation/types";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { FacultyAvatar } from "@/components/ui/faculty-avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { EvaluationFormView } from "@/components/evaluation/evaluation-form";

export const metadata: Metadata = { title: "Evaluate Instructor" };

export default async function EvaluatePage({ params }: PageProps<"/student/evaluate/[offeringId]">) {
  await requireRole("student");
  const { offeringId } = await params;
  if (!z.uuid().safeParse(offeringId).success) notFound();
  const supabase = await createClient();
  // The RPC verifies the signed-in student is enrolled in this class; changing
  // the URL to another class returns an authorization error, never data.
  const { data, error } = await supabase.rpc("get_evaluation_form", { p_offering_id: offeringId });
  if (error || !data) {
    return (
      <Card className="mx-auto mt-6 max-w-lg">
        <EmptyState title="Evaluation not available" description="You can only evaluate subjects you are officially enrolled in." />
      </Card>
    );
  }
  const form = data as unknown as EvaluationForm;
  const status = form.attempt?.status === "completed" ? "completed" : form.period.status === "active" ? (form.attempt ? "in_progress" : "not_started") : form.period.status;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Faculty Evaluation" breadcrumbs={[{ label: "My Evaluations", href: "/student/dashboard" }, { label: form.offering.subject_code }]} />
      <Card outline="brand" className="mb-5">
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <FacultyAvatar name={form.faculty.name} src={publicStorageUrl("faculty-photos", form.faculty.photo_path)} size="lg" className="ring-brand-100" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Instructor</p>
            <h2 className="text-xl font-semibold text-gray-900">{form.faculty.name}</h2>
            <p className="text-sm text-gray-600">{form.faculty.department_name}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:text-right">
            <dt className="text-gray-500 sm:col-span-2">Subject</dt>
            <dd className="col-span-2 font-semibold text-gray-900">{form.offering.subject_code}{form.offering.section ? ` (${form.offering.section})` : ""} — {form.offering.subject_title}</dd>
            <dt className="text-gray-500">Semester</dt><dd className="font-medium">{semesterLabel(form.period.semester)}</dd>
            <dt className="text-gray-500">School Year</dt><dd className="font-medium">S.Y. {form.period.school_year}</dd>
          </dl>
        </CardBody>
        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-4 py-2.5 text-xs text-gray-600">
          <StatusBadge status={status} />
          <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-brand-600" aria-hidden /> Confidential — instructors only see anonymous, combined results.</span>
        </div>
      </Card>
      <EvaluationFormView form={form} />
    </div>
  );
}
