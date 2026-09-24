export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export type FlatParams = Record<string, string>;

export async function readParams(sp: SearchParams | undefined): Promise<FlatParams> {
  const raw = (await sp) ?? {};
  const out: FlatParams = {};
  for (const [k, v] of Object.entries(raw)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (typeof val === "string" && val !== "") out[k] = val.slice(0, 200);
  }
  return out;
}

export function hrefWith(basePath: string, params: FlatParams, overrides: Record<string, string | number | null | undefined>) {
  const q = new URLSearchParams(params);
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null || v === undefined || v === "") q.delete(k);
    else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `${basePath}?${s}` : basePath;
}

export type ListQuery = { q: string; page: number; pageSize: number; sort: string; dir: "asc" | "desc"; from: number; to: number };

/** Normalizes list params (search, sort whitelist, pagination). */
export function listQuery(params: FlatParams, opts: { sortable: string[]; defaultSort: string; defaultDir?: "asc" | "desc"; pageSize?: number }): ListQuery {
  const pageSize = Math.min(Math.max(Number(params.size) || opts.pageSize || 15, 5), 100);
  const page = Math.max(Number(params.page) || 1, 1);
  const sort = opts.sortable.includes(params.sort ?? "") ? params.sort : opts.defaultSort;
  const dir = params.dir === "asc" || params.dir === "desc" ? params.dir : (opts.defaultDir ?? "asc");
  // Only letters, numbers, spaces and a few symbols reach the ILIKE pattern.
  const q = (params.q ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s.@\-_]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const from = (page - 1) * pageSize;
  return { q, page, pageSize, sort, dir, from, to: from + pageSize - 1 };
}

/** Escapes LIKE wildcards so user text is matched literally. */
export function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}
