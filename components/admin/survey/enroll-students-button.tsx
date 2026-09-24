"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { enrollStudents, searchStudentsForEnrollment, type StudentOption } from "@/app/admin/surveys/actions";

export function EnrollStudentsButton({ offeringId, programs, defaultProgramId }: {
  offeringId: string; programs: { id: string; code: string }[]; defaultProgramId: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [programId, setProgramId] = useState(defaultProgramId);
  const [results, setResults] = useState<StudentOption[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      startLoading(async () => {
        const res = await searchStudentsForEnrollment({ offeringId, q, programId });
        setResults(res.ok ? res.data : []);
        if (!res.ok) toast.error(res.error);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [open, q, programId, offeringId]);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = !!results?.length && results.every((r) => selected.has(r.id));

  return (
    <>
      <Button onClick={() => { setOpen(true); setSelected(new Set()); }}><UserPlus className="h-4 w-4" /> Enroll Students</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        busy={saving}
        size="lg"
        title="Enroll Students"
        description="Only enrolled students can evaluate this class. Expected evaluations = enrolled students."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button
              loading={saving}
              disabled={selected.size === 0}
              onClick={() => startSaving(async () => {
                const res = await enrollStudents({ offering_id: offeringId, student_ids: [...selected] });
                if (res.ok) { toast.success(`${res.data.added} student(s) enrolled.`); setOpen(false); } else toast.error(res.error);
              })}
            >
              Enroll {selected.size || ""} student{selected.size === 1 ? "" : "s"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
            <label htmlFor="enroll-search" className="sr-only">Search students</label>
            <input id="enroll-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID or name…" maxLength={80}
              className="h-10 w-full rounded-md border border-gray-300 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25" />
          </div>
          <label className="sr-only" htmlFor="enroll-program">Program</label>
          <Select id="enroll-program" value={programId} onChange={(e) => setProgramId(e.target.value)} className="sm:w-44">
            <option value="">All programs</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
          </Select>
        </div>
        <div className="mt-3 rounded-md border border-gray-200">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <label className="flex items-center gap-2 font-semibold text-gray-700">
              <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={allSelected} disabled={!results?.length}
                onChange={() => setSelected((s) => { const n = new Set(s); results?.forEach((r) => (allSelected ? n.delete(r.id) : n.add(r.id))); return n; })} />
              Select all shown
            </label>
            <span className="text-gray-500">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `${results?.length ?? 0} available`}</span>
          </div>
          <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
            {results && results.length === 0 && !loading && (
              <li><EmptyState title="No students available" description="All matching students are already enrolled." className="py-8" /></li>
            )}
            {results?.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50">
                  <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                  <span className="w-24 shrink-0 font-mono text-xs text-gray-600">{s.student_number}</span>
                  <span className="flex-1 font-medium text-gray-900">{s.full_name}</span>
                  <span className="text-xs text-gray-500">{s.program_code} · {s.year_level_name}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </>
  );
}
