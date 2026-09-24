// Import types shared by server validation and the client-side ImportWizard.

/** Record imports (students, faculty, questions) classify every row. */
export type ImportRowStatus = "add" | "exists" | "invalid";

export type PreviewRow = {
  row: number;
  cells: Record<string, string>;
  errors: string[];
  warnings: string[];
  status?: ImportRowStatus;
};

export type ImportPreview = {
  fileName: string;
  rows: PreviewRow[];
  summary: Record<string, number>;
};

export type ImportResultRow = {
  row: number;
  cells: Record<string, string>;
  status: "added" | "skipped" | "failed";
  reason?: string;
  /** temporary password of a newly created login account (shown once) */
  tempPassword?: string;
};

export type RecordImportResult = {
  counts: { total: number; added: number; skipped: number; failed: number };
  rows: ImportResultRow[];
};
