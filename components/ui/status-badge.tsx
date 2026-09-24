import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  green: "bg-brand-50 text-brand-700 ring-brand-600/20",
  gray: "bg-gray-100 text-gray-600 ring-gray-500/20",
  yellow: "bg-amber-50 text-amber-800 ring-amber-600/25",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  teal: "bg-teal-50 text-teal-700 ring-teal-600/20",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({ tone = "gray", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}

const STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  active: { tone: "green", label: "Active" },
  inactive: { tone: "gray", label: "Inactive" },
  pending: { tone: "gray", label: "Pending" },
  not_started: { tone: "gray", label: "Not Started" },
  in_progress: { tone: "yellow", label: "In Progress" },
  ongoing: { tone: "yellow", label: "On-going" },
  completed: { tone: "green", label: "Completed" },
  closed: { tone: "red", label: "Evaluation Closed" },
  expired: { tone: "red", label: "Closed" },
  upcoming: { tone: "blue", label: "Upcoming" },
  current: { tone: "teal", label: "Current" },
  released: { tone: "green", label: "Released" },
  hidden: { tone: "gray", label: "Not Released" },
};

/** Consistent status chip. Pass `label` to override the default wording. */
export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const s = STATUS[status] ?? { tone: "gray" as const, label: status };
  return (
    <Badge tone={s.tone} className={className}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {label ?? s.label}
    </Badge>
  );
}
