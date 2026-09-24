import "server-only";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { UserFacingError } from "@/lib/actions";

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export type RawRow = { rowNumber: number; values: Record<string, string> };

export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Parses an uploaded CSV/XLSX file into rows keyed by canonical column names.
 * `columns` maps canonical name → accepted header aliases (normalized).
 */
export async function parseSpreadsheet(
  file: File,
  columns: Record<string, string[]>,
  required: string[],
  maxRows: number,
): Promise<{ rows: RawRow[]; headers: string[] }> {
  if (!(file instanceof File) || file.size === 0) throw new UserFacingError("Please choose a CSV or XLSX file.");
  if (file.size > IMPORT_MAX_BYTES) throw new UserFacingError("The file is larger than 5 MB. Split it into smaller files.");
  const name = file.name.toLowerCase();
  const isCsv = name.endsWith(".csv");
  const isXlsx = name.endsWith(".xlsx");
  if (!isCsv && !isXlsx) throw new UserFacingError("Only .csv and .xlsx files are supported.");

  let table: string[][];
  if (isCsv) {
    const text = (await file.text()).replace(/^﻿/, "");
    const res = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
    if (res.errors.length && !res.data.length) throw new UserFacingError("The CSV file could not be read.");
    table = res.data;
  } else {
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (!(head[0] === 0x50 && head[1] === 0x4b)) throw new UserFacingError("The file is not a valid XLSX workbook.");
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(await file.arrayBuffer());
    } catch {
      throw new UserFacingError("The XLSX file could not be read. Save it again from Excel and retry.");
    }
    const ws = wb.worksheets[0];
    if (!ws) throw new UserFacingError("The workbook has no worksheets.");
    table = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      for (let c = 1; c <= ws.columnCount; c++) {
        const cell = row.getCell(c);
        const v = cell.value;
        cells.push(v instanceof Date ? v.toISOString() : (cell.text ?? "").toString());
      }
      table.push(cells);
    });
  }

  if (table.length < 2) throw new UserFacingError("The file has no data rows below the header row.");
  if (table.length - 1 > maxRows) throw new UserFacingError(`The file has too many rows (maximum ${maxRows.toLocaleString()}).`);

  const headers = table[0].map((h) => String(h ?? "").trim());
  const index: Record<string, number> = {};
  headers.forEach((h, i) => {
    const n = normalizeHeader(h);
    for (const [canon, aliases] of Object.entries(columns)) {
      if (index[canon] === undefined && aliases.includes(n)) index[canon] = i;
    }
  });
  const missing = required.filter((r) => index[r] === undefined);
  if (missing.length) {
    throw new UserFacingError(`Missing required column(s): ${missing.join(", ")}. Download the template for the expected format.`);
  }

  const rows: RawRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const values: Record<string, string> = {};
    for (const [canon, col] of Object.entries(index)) values[canon] = String(table[i][col] ?? "").trim().slice(0, 1000);
    if (Object.values(values).every((v) => v === "")) continue;
    rows.push({ rowNumber: i + 1, values });
  }
  if (!rows.length) throw new UserFacingError("The file has no data rows.");
  return { rows, headers };
}

/** "2026-2027", "S.Y. 2026-2027", "SY 2026–2027" or "2026" → 2026 */
export function parseSchoolYear(v: string): number | null {
  const m = v.match(/(\d{4})\s*[-–/]\s*(\d{4})/);
  if (m) {
    const a = Number(m[1]);
    return Number(m[2]) === a + 1 && a >= 2006 && a <= 2100 ? a : null;
  }
  const single = v.match(/^\s*(\d{4})\s*$/);
  if (single) {
    const a = Number(single[1]);
    return a >= 2006 && a <= 2100 ? a : null;
  }
  return null;
}

/** "1", "1st", "First Semester" → 1; "2", "2nd", "Second" → 2 */
export function parseSemester(v: string): 1 | 2 | null {
  const s = v.toLowerCase().trim();
  if (/^(1|1st|first)\b/.test(s) || s === "1st semester") return 1;
  if (/^(2|2nd|second)\b/.test(s) || s === "2nd semester") return 2;
  return null;
}
