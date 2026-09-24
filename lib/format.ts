const TZ = "Asia/Manila";

export function formatPersonName(first?: string | null, middle?: string | null, last?: string | null): string {
  const mi = middle?.trim() ? `${middle.trim()[0].toUpperCase()}.` : null;
  return [first?.trim(), mi, last?.trim()].filter(Boolean).join(" ");
}

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function formatDate(value: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PH", { timeZone: TZ, year: "numeric", month: "short", day: "numeric", ...opts }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, { hour: "numeric", minute: "2-digit" });
}

export function formatRelative(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`;
  return formatDate(d);
}

/** "2026-09-24T08:00" style value for <input type="datetime-local"> in Manila time. */
export function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

/** Interprets a datetime-local value as Manila time and returns ISO. */
export function fromDateTimeLocal(value: string): string {
  return new Date(`${value}:00+08:00`).toISOString();
}

export function semesterLabel(semester: number): string {
  return semester === 1 ? "1st Semester" : "2nd Semester";
}

export function schoolYearLabel(startYear: number): string {
  return `S.Y. ${startYear}-${startYear + 1}`;
}

export function periodLabel(startYear: number, semester: number): string {
  return `${semesterLabel(semester)} of ${schoolYearLabel(startYear)}`;
}

export function formatNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-PH", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

export function formatRating(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  return Number(n).toFixed(2);
}

export function percent(part: number, whole: number, digits = 1): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100 * 10 ** digits) / 10 ** digits;
}

/** Whole years between a date and today (age / years of service). */
export function yearsSince(date: string | null | undefined, at: Date = new Date()): number | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00+08:00`);
  let years = at.getFullYear() - d.getFullYear();
  const m = at.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < d.getDate())) years--;
  return years;
}

/** Whether an evaluation window is open now, and whole days until it closes. */
export function periodWindow(openAt?: string | null, closeAt?: string | null): { isOpen: boolean; daysLeft: number } {
  if (!openAt || !closeAt) return { isOpen: false, daysLeft: 0 };
  const now = Date.now();
  const open = new Date(openAt).getTime();
  const close = new Date(closeAt).getTime();
  return { isOpen: now >= open && now <= close, daysLeft: Math.max(0, Math.ceil((close - now) / 86_400_000)) };
}
