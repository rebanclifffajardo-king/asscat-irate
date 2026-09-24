"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageSquareText } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RatingDisplay } from "@/components/ui/rating-display";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAttemptAnswers, type AttemptAnswers } from "@/app/admin/surveys/actions";
import { formatDateTime } from "@/lib/format";

export function ViewAnswersModal({ attemptId, onClose }: { attemptId: string; onClose: () => void }) {
  const [data, setData] = useState<AttemptAnswers | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getAttemptAnswers(attemptId).then((res) => {
      if (!alive) return;
      if (res.ok) setData(res.data);
      else setError(res.error);
    });
    return () => { alive = false; };
  }, [attemptId]);

  return (
    <Modal open onClose={onClose} title="Evaluation Answers" description={data?.student} size="xl" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {!data && !error && <div className="flex justify-center py-12 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>}
      {error && <EmptyState title="Unable to load answers" description={error} />}
      {data && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <StatusBadge status={data.status === "in_progress" ? "ongoing" : data.status} />
            {data.submitted_at && <span className="text-gray-500">Submitted {formatDateTime(data.submitted_at)}</span>}
            {data.average !== null && <RatingDisplay value={data.average} />}
          </div>
          <Tabs
            tabs={[
              {
                id: "ratings",
                label: `Ratings (${data.answers.length})`,
                content: data.answers.length === 0 ? <EmptyState title="No ratings yet" /> : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-600">
                        <tr><th className="px-3 py-2">Category</th><th className="px-3 py-2">Question</th><th className="px-3 py-2 text-center">Rating</th><th className="px-3 py-2">Equivalent</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.answers.map((a, i, all) => {
                          const showCat = i === 0 || all[i - 1].category !== a.category;
                          return (
                            <tr key={i}>
                              <td className="px-3 py-2 align-top font-semibold text-gray-800">{showCat ? a.category : ""}</td>
                              <td className="px-3 py-2 text-gray-700"><span className="mr-1 font-semibold text-gray-500">{a.title}</span>{a.question}</td>
                              <td className="px-3 py-2 text-center font-bold tabular-nums">{a.rating}<span className="font-normal text-gray-400">/{a.scale_max}</span></td>
                              <td className="px-3 py-2 text-gray-600">{a.label ?? "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ),
              },
              {
                id: "comments",
                label: "Comments",
                content: data.comment ? (
                  <blockquote className="flex gap-3 rounded-md border-l-4 border-brand-500 bg-gray-50 p-4 text-gray-800">
                    <MessageSquareText className="h-5 w-5 shrink-0 text-brand-500" aria-hidden />
                    <p className="whitespace-pre-wrap">{data.comment}</p>
                  </blockquote>
                ) : <EmptyState title="No comments" description="The student did not leave comments for the instructor." />,
              },
            ]}
          />
        </>
      )}
    </Modal>
  );
}
