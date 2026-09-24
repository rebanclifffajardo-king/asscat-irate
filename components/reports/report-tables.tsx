import type { AdminAnalytics } from "@/lib/analytics/admin";
import { completionRate } from "@/lib/analytics/admin";
import { formatNumber, formatRating } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { EvaluationProgress } from "@/components/ui/evaluation-progress";
import { RatingDisplay, type ScalePoint } from "@/components/ui/rating-display";

const th = "px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-600";
const td = "px-3 py-2";

export function TopFacultyTable({ a, scale }: { a: AdminAnalytics; scale: ScalePoint[] }) {
  if (!a.top_faculty.length) return <EmptyState title="No faculty meet the minimum respondents" description={`Rankings require at least ${a.min_respondents} completed evaluations.`} />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50"><tr><th className={th}>#</th><th className={th}>Faculty</th><th className={th}>Department</th><th className={th}>Average Rating</th><th className={`${th} text-right`}>Evaluations</th></tr></thead>
        <tbody className="divide-y divide-gray-100">
          {a.top_faculty.map((f, i) => (
            <tr key={f.id}>
              <td className={`${td} font-bold text-gray-500`}>{i + 1}</td>
              <td className={td}><span className="font-semibold text-gray-900">{f.name}</span><span className="block text-xs text-gray-500">{f.faculty_number}</span></td>
              <td className={td} title={f.department_name}>{f.department_code}</td>
              <td className={td}><RatingDisplay value={f.average} max={scale.length} scale={scale} /></td>
              <td className={`${td} text-right tabular-nums`}>{formatNumber(f.respondents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QuestionAveragesTable({ a }: { a: AdminAnalytics }) {
  if (!a.questions.length) return <EmptyState title="No answers yet" />;
  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-gray-50"><tr><th className={th}>Category</th><th className={th}>Question</th><th className={`${th} text-right`}>Average</th><th className={`${th} text-right`}>Responses</th></tr></thead>
        <tbody className="divide-y divide-gray-100">
          {a.questions.map((q, i) => (
            <tr key={i}>
              <td className={`${td} whitespace-nowrap text-gray-600`}>{q.category}</td>
              <td className={td}><span className="mr-1 font-semibold text-gray-500">{q.title}</span>{q.content}</td>
              <td className={`${td} text-right font-semibold tabular-nums`}>{formatRating(q.average)}</td>
              <td className={`${td} text-right tabular-nums text-gray-600`}>{formatNumber(q.responses)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RespondentsTable({ a }: { a: AdminAnalytics }) {
  if (!a.faculty_respondents.length) return <EmptyState title="No classes in scope" />;
  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-gray-50"><tr><th className={th}>Faculty</th><th className={th}>Dept</th><th className={th}>Respondents</th><th className={`${th} text-right`}>Average</th></tr></thead>
        <tbody className="divide-y divide-gray-100">
          {a.faculty_respondents.map((f) => (
            <tr key={f.id}>
              <td className={`${td} font-medium text-gray-900`}>{f.name}</td>
              <td className={td}>{f.department_code}</td>
              <td className={td}><EvaluationProgress completed={f.respondents} total={f.expected} compact /></td>
              <td className={`${td} text-right tabular-nums`}>
                {f.respondents >= a.min_respondents ? formatRating(f.average) : <span className="text-xs text-gray-400" title={`Fewer than ${a.min_respondents} respondents`}>n&lt;{a.min_respondents}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CompletionTable({ rows, label }: { rows: { code?: string; name: string; expected: number; completed: number }[]; label: string }) {
  if (!rows.length) return <EmptyState title="No enrollments in scope" />;
  return (
    <table className="min-w-full text-sm">
      <thead className="bg-gray-50"><tr><th className={th}>{label}</th><th className={`${th} text-right`}>Completed</th><th className={`${th} text-right`}>Pending</th><th className={`${th} text-right`}>Expected</th><th className={`${th} text-right`}>Completion</th></tr></thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map((r) => (
          <tr key={r.code ?? r.name}>
            <td className={`${td} font-medium`} title={r.name}>{r.code ?? r.name}</td>
            <td className={`${td} text-right tabular-nums`}>{formatNumber(r.completed)}</td>
            <td className={`${td} text-right tabular-nums`}>{formatNumber(r.expected - r.completed)}</td>
            <td className={`${td} text-right tabular-nums`}>{formatNumber(r.expected)}</td>
            <td className={`${td} text-right font-semibold tabular-nums`}>{completionRate(r.completed, r.expected)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
