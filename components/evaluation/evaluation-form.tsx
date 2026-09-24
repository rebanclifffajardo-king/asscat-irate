"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Cloud, CloudOff, Loader2, Lock, Send } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/field";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import type { EvaluationForm } from "@/lib/evaluation/types";
import { saveEvaluationProgress, submitEvaluation } from "@/app/student/actions";

type Step = "answer" | "review" | "done";

export function EvaluationFormView({ form }: { form: EvaluationForm }) {
  const completed = form.attempt?.status === "completed";
  const closed = form.period.status !== "active";
  const readOnly = completed || closed;

  const [answers, setAnswers] = useState<Record<string, number>>(form.answers ?? {});
  const [comment, setComment] = useState(form.comment ?? "");
  const [step, setStep] = useState<Step>("answer");
  const [savedAt, setSavedAt] = useState<string | null>(form.attempt?.updated_at ?? null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [confirm, setConfirm] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const [showMissing, setShowMissing] = useState(false);
  const dirty = useRef(false);
  const inFlight = useRef(false);

  const questions = useMemo(() => form.categories.flatMap((c) => c.questions), [form.categories]);
  const required = useMemo(() => questions.filter((q) => q.is_required), [questions]);
  const missing = required.filter((q) => !answers[q.id]);
  const answeredCount = questions.filter((q) => answers[q.id]).length;
  const progress = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
  const commentMissing = form.allow_comments && form.require_comments && !comment.trim();
  const maxScale = form.scale.length;

  const payload = useCallback(
    () => ({ offering_id: form.offering.id, answers, comment: form.allow_comments ? comment : null }),
    [answers, comment, form.allow_comments, form.offering.id],
  );

  const save = useCallback(async (silent = true) => {
    if (readOnly || inFlight.current) return;
    inFlight.current = true;
    dirty.current = false;
    setSaveState("saving");
    const res = await saveEvaluationProgress(payload());
    inFlight.current = false;
    if (res.ok) {
      setSavedAt(res.data.saved_at);
      setSaveState("idle");
      if (!silent) toast.success("Progress saved.");
    } else {
      setSaveState("error");
      dirty.current = true;
      toast.error(res.error);
    }
  }, [payload, readOnly]);

  // Debounced autosave while answering.
  useEffect(() => {
    if (readOnly || !dirty.current) return;
    const t = setTimeout(() => void save(true), 1500);
    return () => clearTimeout(t);
  }, [answers, comment, readOnly, save]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current && step !== "done") e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [step]);

  const setAnswer = (qid: string, value: number) => {
    if (readOnly) return;
    dirty.current = true;
    setAnswers((a) => ({ ...a, [qid]: value }));
  };

  const goReview = () => {
    if (missing.length || commentMissing) {
      setShowMissing(true);
      const first = missing[0];
      if (first) document.getElementById(`q-${first.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      else document.getElementById("comment")?.focus();
      toast.error(missing.length ? `Please answer all required questions (${missing.length} remaining).` : "Please add your comments for the instructor.");
      return;
    }
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = () =>
    new Promise<void>((resolve) => {
      startSubmit(async () => {
        const res = await submitEvaluation(payload());
        if (res.ok) {
          dirty.current = false;
          setConfirm(false);
          setStep("done");
          window.scrollTo({ top: 0 });
        } else {
          toast.error(res.error);
        }
        resolve();
      });
    });

  if (step === "done") {
    return (
      <Card outline="brand">
        <CardBody className="flex flex-col items-center py-12 text-center">
          <CheckCircle2 className="h-14 w-14 text-brand-500" aria-hidden />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Evaluation submitted</h2>
          <p className="mt-1 max-w-md text-sm text-gray-600">
            Thank you! Your evaluation of <strong>{form.faculty.name}</strong> for {form.offering.subject_code} has been recorded.
            Your identity is never shown to your instructor.
          </p>
          <Link href="/student/dashboard" className={buttonClasses("primary", "md", "mt-6")}>Back to my evaluations</Link>
        </CardBody>
      </Card>
    );
  }

  const scaleLegend = (
    <div className="flex flex-wrap gap-2 text-xs" aria-hidden>
      {form.scale.map((s) => (
        <span key={s.value} className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-700">{s.value} – {s.label}</span>
      ))}
    </div>
  );

  if (step === "review") {
    return (
      <div className="space-y-5">
        <Card outline="brand">
          <CardHeader title="Review Your Evaluation" description="Check your answers before submitting. You cannot change them after submission." icon={<ClipboardCheck className="h-5 w-5 text-brand-600" />} />
          <div className="divide-y divide-gray-100">
            {form.categories.map((c) => (
              <section key={c.name} className="px-4 py-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600">{c.name}</h3>
                <ul className="mt-2 space-y-1.5">
                  {c.questions.map((q) => (
                    <li key={q.id} className="flex items-start justify-between gap-4 text-sm">
                      <span className="text-gray-700">{q.content}</span>
                      <span className="shrink-0 font-semibold text-gray-900">
                        {answers[q.id] ? `${answers[q.id]} – ${form.scale[answers[q.id] - 1]?.label}` : <span className="text-gray-400">Not answered</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {form.allow_comments && (
              <section className="px-4 py-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600">Comments / Suggestions</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{comment.trim() || <span className="text-gray-400">No comments</span>}</p>
              </section>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-gray-200 px-4 py-3 sm:flex-row sm:justify-between">
            <Button variant="secondary" onClick={() => setStep("answer")} disabled={submitting}><ArrowLeft className="h-4 w-4" /> Back to edit</Button>
            <Button onClick={() => setConfirm(true)} loading={submitting}>{!submitting && <Send className="h-4 w-4" />} Submit Evaluation</Button>
          </div>
        </Card>
        <ConfirmationDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          tone="primary"
          title="Submit evaluation?"
          message="Once submitted, your evaluation is final and can no longer be edited. Your identity will not be shown to the instructor."
          confirmLabel="Submit Evaluation"
          onConfirm={submit}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {completed && (
        <Alert tone="success" title="Evaluation submitted">
          You submitted this evaluation on {formatDateTime(form.attempt?.submitted_at)}. Submitted evaluations cannot be edited.
        </Alert>
      )}
      {!completed && form.period.status === "closed" && (
        <Alert tone="danger" title="Evaluation closed">The evaluation period ended on {formatDateTime(form.period.close_at)}.</Alert>
      )}
      {!completed && form.period.status === "upcoming" && (
        <Alert tone="info" title="Not yet open">This evaluation opens on {formatDateTime(form.period.open_at)}.</Alert>
      )}

      {!readOnly && (
        <div className="sticky top-14 z-20 -mx-3 border-b border-gray-200 bg-page/95 px-3 py-2 backdrop-blur sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-xs font-semibold text-gray-600">
                <span>{answeredCount} of {questions.length} answered</span>
                <span className="inline-flex items-center gap-1" aria-live="polite">
                  {saveState === "saving" ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
                    : saveState === "error" ? <><CloudOff className="h-3 w-3 text-lte-danger" /> Not saved</>
                    : savedAt ? <><Cloud className="h-3 w-3 text-brand-600" /> Saved {formatDateTime(savedAt)}</> : "Not saved yet"}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Evaluation progress">
                <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardBody className="space-y-2">
          <p className="text-sm text-gray-700">
            {readOnly ? "Your answers:" : `Rate your instructor on each statement using the scale below (1 = lowest, ${maxScale} = highest). Questions marked * are required.`}
          </p>
          {scaleLegend}
        </CardBody>
      </Card>

      {form.categories.map((c, ci) => (
        <Card key={c.name} outline="brand">
          <CardHeader title={`${ci + 1}. ${c.name}`} description={c.description ?? undefined} />
          <div className="divide-y divide-gray-100">
            {c.questions.map((q, qi) => {
              const value = answers[q.id];
              const isMissing = showMissing && q.is_required && !value;
              return (
                <fieldset key={q.id} id={`q-${q.id}`} className={cn("scroll-mt-32 px-4 py-4", isMissing && "bg-red-50")} aria-invalid={isMissing || undefined}>
                  <legend className="sr-only">{q.content}</legend>
                  <p className="text-[15px] text-gray-800" aria-hidden>
                    <span className="mr-1 font-semibold text-gray-500">{ci + 1}.{qi + 1}</span>
                    {q.content}
                    {q.is_required && !readOnly && <span className="ml-0.5 text-lte-danger">*</span>}
                  </p>
                  {isMissing && <p className="mt-1 text-xs font-semibold text-lte-danger">This question is required.</p>}
                  <div className="mt-3 grid grid-cols-5 gap-2" style={{ gridTemplateColumns: `repeat(${maxScale}, minmax(0, 1fr))` }}>
                    {form.scale.map((s) => {
                      const checked = value === s.value;
                      return (
                        <label
                          key={s.value}
                          className={cn(
                            "flex min-h-14 flex-col items-center justify-center rounded-md border px-1 py-2 text-center transition-colors select-none",
                            readOnly ? "cursor-default" : "cursor-pointer hover:border-brand-400 hover:bg-brand-50",
                            checked ? "border-brand-500 bg-brand-500 text-white hover:bg-brand-600" : "border-gray-300 bg-white text-gray-700",
                            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 has-[:focus-visible]:ring-offset-1",
                          )}
                        >
                          <input
                            type="radio"
                            className="sr-only"
                            name={`q-${q.id}`}
                            value={s.value}
                            checked={checked}
                            disabled={readOnly && !checked}
                            readOnly={readOnly}
                            onChange={() => setAnswer(q.id, s.value)}
                            aria-label={`${s.value} – ${s.label}`}
                          />
                          <span className="text-lg font-bold leading-none">{s.value}</span>
                          <span className={cn("mt-1 text-[11px] leading-tight", checked ? "text-white/90" : "text-gray-500")}>{s.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>
        </Card>
      ))}

      {form.allow_comments && (
        <Card>
          <CardHeader title="Comments / Suggestions for Instructor" description="Optional unless stated. Please be respectful and constructive. Your name is never shown to the instructor." />
          <CardBody>
            <label htmlFor="comment" className="sr-only">Comments or suggestions for the instructor</label>
            <Textarea
              id="comment"
              value={comment}
              readOnly={readOnly}
              maxLength={3000}
              rows={5}
              onChange={(e) => { dirty.current = true; setComment(e.target.value); }}
              placeholder={readOnly ? "No comments" : "What does your instructor do well? What could be improved?"}
              aria-invalid={showMissing && commentMissing}
            />
            <p className="mt-1 text-right text-xs text-gray-500">{comment.length}/3000{form.require_comments ? " · required" : ""}</p>
          </CardBody>
        </Card>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Link href="/student/dashboard" className={buttonClasses("secondary")}><ArrowLeft className="h-4 w-4" /> My evaluations</Link>
        {readOnly ? (
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500"><Lock className="h-4 w-4" /> Read-only</span>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" onClick={() => void save(false)} loading={saveState === "saving"}>Save progress</Button>
            <Button onClick={goReview}><ClipboardCheck className="h-4 w-4" /> Review Your Evaluation</Button>
          </div>
        )}
      </div>
    </div>
  );
}
