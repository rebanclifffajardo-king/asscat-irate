"use client";

import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { useServerAction } from "@/lib/hooks/use-server-action";
import { saveEvaluationSettings } from "@/app/admin/settings/actions";
import type { AppSettings } from "@/lib/data/lookups";
import { cn } from "@/lib/utils";

const VISIBILITY = [
  { value: "immediate", label: "Immediately", hint: "Faculty see results as soon as evaluations are submitted (subject to the minimum respondents)." },
  { value: "after_close", label: "After survey closes", hint: "Results become visible automatically when the evaluation period closes." },
  { value: "manual", label: "Manually released by administrator", hint: "Results stay hidden until you release them from the Survey Schedule tab." },
] as const;

export function EvaluationSettingsForm({ settings }: { settings: AppSettings }) {
  const { run, pending, fieldErrors: fe } = useServerAction(saveEvaluationSettings);
  const [visibility, setVisibility] = useState(settings.results_visibility);
  const [scale, setScale] = useState(settings.rating_scale.map((p) => p.label));
  const [allowComments, setAllowComments] = useState(settings.allow_comments);

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run({
          results_visibility: visibility,
          min_respondents: f.get("min_respondents"),
          allow_comments: allowComments,
          require_comments: f.get("require_comments") === "on",
          deadline_reminder_days: f.get("deadline_reminder_days"),
          scale: scale.map((label, i) => ({ value: i + 1, label: label.trim() })),
        });
      }}
    >
      <fieldset>
        <legend className="text-sm font-semibold text-gray-700">Faculty results visibility</legend>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {VISIBILITY.map((o) => (
            <label key={o.value} className={cn("cursor-pointer rounded-md border p-3 text-sm transition-colors", visibility === o.value ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-gray-200 hover:border-gray-300")}>
              <span className="flex items-center gap-2 font-semibold text-gray-800">
                <input type="radio" name="results_visibility" value={o.value} checked={visibility === o.value} onChange={() => setVisibility(o.value)} className="accent-brand-500" />
                {o.label}
              </span>
              <span className="mt-1 block text-xs text-gray-500">{o.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Minimum respondents" htmlFor="min_respondents" error={fe.min_respondents} hint="Faculty results and rankings require at least this many completed evaluations (protects anonymity).">
          <Input id="min_respondents" name="min_respondents" type="number" min={1} max={50} defaultValue={settings.min_respondents} aria-describedby="min_respondents-msg" />
        </Field>
        <Field label="Deadline reminder (days before close)" htmlFor="deadline_reminder_days" error={fe.deadline_reminder_days} hint="Students with pending evaluations are notified.">
          <Input id="deadline_reminder_days" name="deadline_reminder_days" type="number" min={0} max={30} defaultValue={settings.deadline_reminder_days} aria-describedby="deadline_reminder_days-msg" />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <Checkbox label="Show the Comments / Suggestions box on the evaluation form" checked={allowComments} onChange={(e) => setAllowComments(e.target.checked)} />
        <Checkbox name="require_comments" label="Require a comment before submission" defaultChecked={settings.require_comments} disabled={!allowComments} />
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-gray-700">Likert rating scale</legend>
        <Alert tone="warning" className="mt-2">
          Changing the number of scale points affects comparability with past semesters. Answers keep a snapshot of the scale used at submission.
        </Alert>
        {typeof fe.scale?.[0] === "string" && <p className="mt-2 text-xs font-medium text-lte-danger">{fe.scale[0]}</p>}
        <ol className="mt-3 space-y-2">
          {scale.map((label, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-500 font-bold text-white">{i + 1}</span>
              <label className="sr-only" htmlFor={`scale-${i}`}>Label for rating {i + 1}</label>
              <Input id={`scale-${i}`} value={label} maxLength={40} onChange={(e) => setScale((s) => s.map((x, j) => (j === i ? e.target.value : x)))} />
              <Button variant="ghost" size="icon" aria-label={`Remove rating ${i + 1}`} disabled={scale.length <= 3 || i !== scale.length - 1} onClick={() => setScale((s) => s.slice(0, -1))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ol>
        <Button variant="secondary" size="sm" className="mt-2" disabled={scale.length >= 10} onClick={() => setScale((s) => [...s, ""])}>
          <Plus className="h-4 w-4" /> Add scale point
        </Button>
      </fieldset>

      <Button type="submit" loading={pending}>{!pending && <Save className="h-4 w-4" />} Save evaluation settings</Button>
    </form>
  );
}
