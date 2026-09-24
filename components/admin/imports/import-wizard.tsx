"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, RotateCcw, Upload, XCircle } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/status-badge";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { cn } from "@/lib/utils";
import type { ImportPreview } from "@/app/admin/surveys/import-actions";

type Result<T> = { ok: true; data: T; message?: string } | { ok: false; error: string };

type Props = {
  columns: { key: string; label: string }[];
  summaryLabels: Record<string, string>;
  preview: (fd: FormData) => Promise<Result<ImportPreview>>;
  commit: (fd: FormData) => Promise<Result<Record<string, number>>>;
  resultLabels: Record<string, string>;
  templateHref: string;
  doneHref: string;
};

const STEPS = ["Upload file", "Validate & preview", "Import"];

export function ImportWizard({ columns, summaryLabels, preview, commit, resultLabels, templateHref, doneHref }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<Record<string, number> | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [filter, setFilter] = useState<"all" | "errors" | "warnings">("all");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const step = result ? 2 : data ? 1 : 0;

  const fd = () => { const f = new FormData(); f.set("file", file!); return f; };

  const validate = () => {
    if (!file) return;
    startTransition(async () => {
      const res = await preview(fd());
      if (res.ok) setData(res.data);
      else toast.error(res.error);
    });
  };

  const reset = () => { setFile(null); setData(null); setResult(null); setFilter("all"); if (inputRef.current) inputRef.current.value = ""; };

  const errors = data?.summary.errors ?? 0;
  const rows = (data?.rows ?? []).filter((r) => filter === "all" || (filter === "errors" ? r.errors.length : r.warnings.length));

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-2" aria-label="Import steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined}
            className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold",
              i < step ? "bg-brand-100 text-brand-800" : i === step ? "bg-brand-500 text-white" : "bg-gray-200 text-gray-600")}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/30 text-xs">{i < step ? "✓" : i + 1}</span>{s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card outline="brand">
          <CardHeader title="1. Upload file" description="CSV or XLSX (first worksheet), up to 5 MB. The first row must contain column headers."
            actions={<a href={templateHref} download className={buttonClasses("secondary", "sm")}><Download className="h-4 w-4" /> Download template</a>} />
          <CardBody>
            <label
              htmlFor="import-file"
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-10 text-center hover:border-brand-400 hover:bg-brand-50/40"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
            >
              <FileSpreadsheet className="h-10 w-10 text-brand-500" aria-hidden />
              <span className="mt-2 font-semibold text-gray-800">{file ? file.name : "Choose a file or drag it here"}</span>
              <span className="text-sm text-gray-500">{file ? `${(file.size / 1024).toFixed(1)} KB` : ".csv or .xlsx"}</span>
              <input ref={inputRef} id="import-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <div className="mt-4 flex justify-end">
              <Button onClick={validate} disabled={!file} loading={pending}><Upload className="h-4 w-4" /> Validate file</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 1 && data && (
        <>
          <Card outline={errors ? "danger" : "brand"}>
            <CardHeader title={`2. Preview — ${data.fileName}`} actions={<Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="h-4 w-4" /> Choose another file</Button>} />
            <CardBody className="space-y-4">
              {errors > 0 ? (
                <Alert tone="danger" title={`${errors} row(s) have errors`}>Nothing will be imported until every error is fixed. Correct the file and upload it again.</Alert>
              ) : (
                <Alert tone="success" title="All rows passed validation">Review the summary, then confirm the import. Rows with warnings will be handled as described.</Alert>
              )}
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Object.entries(summaryLabels).map(([k, label]) => (
                  <div key={k} className="rounded-md border border-gray-200 p-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
                    <dd className={cn("text-xl font-bold tabular-nums", k === "errors" && data.summary[k] ? "text-lte-danger" : "text-gray-900")}>{data.summary[k] ?? 0}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
          <Card>
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3 text-sm">
              <span className="font-semibold text-gray-700">Show:</span>
              {(["all", "errors", "warnings"] as const).map((f) => (
                <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
                  className={cn("rounded-full px-3 py-1 font-semibold", filter === f ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200")}>
                  {f === "all" ? "All rows" : f === "errors" ? "Errors" : "Warnings"}
                </button>
              ))}
              {data.rows.length < data.summary.total && <span className="text-xs text-gray-500">Showing {data.rows.length} of {data.summary.total} rows (all flagged rows included).</span>}
            </div>
            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-600">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    {columns.map((c) => <th key={c.key} className="whitespace-nowrap px-3 py-2">{c.label}</th>)}
                    <th className="px-3 py-2">Validation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r.row} className={r.errors.length ? "bg-red-50/60" : r.warnings.length ? "bg-amber-50/60" : undefined}>
                      <td className="px-3 py-2 tabular-nums text-gray-500">{r.row}</td>
                      {columns.map((c) => <td key={c.key} className="max-w-56 truncate whitespace-nowrap px-3 py-2" title={r.cells[c.key]}>{r.cells[c.key] || <span className="text-gray-300">—</span>}</td>)}
                      <td className="min-w-64 px-3 py-2">
                        {r.errors.map((e) => <p key={e} className="flex items-start gap-1 text-xs text-red-700"><XCircle className="mt-0.5 h-3 w-3 shrink-0" />{e}</p>)}
                        {r.warnings.map((w) => <p key={w} className="flex items-start gap-1 text-xs text-amber-800"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{w}</p>)}
                        {!r.errors.length && !r.warnings.length && <Badge tone="green">OK</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
              <Button variant="secondary" onClick={reset} disabled={pending}>Cancel</Button>
              <Button onClick={() => setConfirm(true)} disabled={errors > 0} loading={pending}>Confirm import</Button>
            </div>
          </Card>
          <ConfirmationDialog
            open={confirm}
            onClose={() => setConfirm(false)}
            tone="primary"
            title="Import records?"
            message={<>Import <strong>{data.summary.valid}</strong> validated row(s) from <strong>{data.fileName}</strong>? The whole file is imported in a single transaction — if anything fails, nothing is saved.</>}
            confirmLabel="Import"
            onConfirm={async () => {
              const res = await commit(fd());
              if (res.ok) { setResult(res.data); setConfirm(false); toast.success(res.message); }
              else { toast.error(res.error); setConfirm(false); }
            }}
          />
        </>
      )}

      {step === 2 && result && (
        <Card outline="brand">
          <CardBody className="flex flex-col items-center py-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-brand-500" aria-hidden />
            <h2 className="mt-3 text-lg font-semibold text-gray-900">Import complete</h2>
            <dl className="mt-5 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(resultLabels).map(([k, label]) => (
                <div key={k} className="rounded-md border border-gray-200 p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
                  <dd className="text-xl font-bold tabular-nums text-gray-900">{result[k] ?? 0}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex gap-2">
              <Button variant="secondary" onClick={reset}>Import another file</Button>
              <Link href={doneHref} className={buttonClasses()}>Go to Survey</Link>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
