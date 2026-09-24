import "server-only";
import type { z } from "zod";
import { UserFacingError } from "@/lib/actions";
import type { ImportPreview, ImportResultRow, PreviewRow, RecordImportResult } from "./types";

/** A classified row of a record import; `data` is set for rows to add. */
export type RecordRow<T> = PreviewRow & { status: NonNullable<PreviewRow["status"]>; data?: T };

const PREVIEW_LIMIT = 500;

/** Only rows with problems + the first N rows are sent back for preview. */
export function previewRows(rows: PreviewRow[]): PreviewRow[] {
  const flagged = rows.filter((r) => r.errors.length || r.warnings.length);
  const clean = rows.filter((r) => !r.errors.length && !r.warnings.length).slice(0, Math.max(0, PREVIEW_LIMIT - flagged.length));
  return [...flagged.slice(0, PREVIEW_LIMIT), ...clean].sort((a, b) => a.row - b.row);
}

export function importFile(formData: FormData): File {
  const f = formData.get("file");
  if (!(f instanceof File)) throw new UserFacingError("Please choose a file to import.");
  return f;
}

/** Preview payload for a record import (row data stays on the server). */
export function recordPreview(fileName: string, rows: RecordRow<unknown>[]): ImportPreview {
  return { fileName, rows: previewRows(rows.map((r) => ({ row: r.row, cells: r.cells, errors: r.errors, warnings: r.warnings, status: r.status }))), summary: recordSummary(rows) };
}

export function resultMessage(c: RecordImportResult["counts"]): string {
  return `${c.added} added, ${c.skipped} skipped, ${c.failed} failed.`;
}

export function recordSummary(rows: RecordRow<unknown>[]) {
  return {
    total: rows.length,
    add: rows.filter((r) => r.status === "add").length,
    exists: rows.filter((r) => r.status === "exists").length,
    invalid: rows.filter((r) => r.status === "invalid").length,
  };
}

/** Zod issues as messages, skipping fields that already have a lookup error. */
export function issueMessages(error: z.ZodError, skipFields: string[] = []): string[] {
  const out = error.issues.filter((i) => !skipFields.includes(String(i.path[0]))).map((i) => i.message);
  return [...new Set(out)];
}

/**
 * Tracks keys (ID, email, …) of rows already accepted from this file so later
 * duplicates are skipped. Returns the earlier row number on a clash.
 */
export class FileDuplicates {
  private seen = new Map<string, number>();
  find(keys: string[]): number | undefined {
    for (const k of keys) {
      const row = this.seen.get(k);
      if (row !== undefined) return row;
    }
    return undefined;
  }
  add(keys: string[], row: number) {
    for (const k of keys) this.seen.set(k, row);
  }
}

/** Blank → fallback; yes/no, true/false, 1/0 → boolean; otherwise null. */
export function parseYesNo(v: string, fallback: boolean): boolean | null {
  const s = v.trim().toLowerCase();
  if (!s) return fallback;
  if (["yes", "y", "true", "1", "required", "active"].includes(s)) return true;
  if (["no", "n", "false", "0", "optional", "inactive"].includes(s)) return false;
  return null;
}

/** "2026-01-31", an ISO date-time (XLSX cells) or "1/31/2026" → "2026-01-31"; other text is returned as-is. */
export function normalizeDate(v: string): string {
  const s = v.trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})(T.*)?$/);
  if (iso) return iso[1];
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return s;
}

export async function inChunks<T>(values: string[], size: number, fetch: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < values.length; i += size) out.push(...(await fetch(values.slice(i, i + size))));
  return out;
}

/**
 * Creates every "add" row with limited concurrency and reports a status for
 * every row in the file. A failing row never stops the others.
 */
export async function commitRecords<T>(
  rows: RecordRow<T>[],
  create: (data: T) => Promise<{ tempPassword?: string }>,
  concurrency = 4,
): Promise<RecordImportResult> {
  const results: ImportResultRow[] = rows.map((r) => ({
    row: r.row,
    cells: r.cells,
    status: r.status === "exists" ? "skipped" : "failed",
    reason: r.status === "exists" ? r.warnings.join(" ") : r.status === "invalid" ? r.errors.join(" ") : undefined,
  }));
  const queue = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.status === "add" && r.data !== undefined);

  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const { r, i } = next;
      try {
        const { tempPassword } = await create(r.data as T);
        results[i] = { ...results[i], status: "added", reason: undefined, tempPassword };
      } catch (e) {
        if (!(e instanceof UserFacingError)) console.error("[import]", e);
        results[i] = { ...results[i], status: "failed", reason: e instanceof UserFacingError ? e.message : "Unexpected error while saving this row." };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));

  return {
    counts: {
      total: results.length,
      added: results.filter((r) => r.status === "added").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "failed").length,
    },
    rows: results,
  };
}
