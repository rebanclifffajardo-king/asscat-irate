import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  info: { cls: "bg-sky-50 text-sky-800 border-sky-200", Icon: Info },
  success: { cls: "bg-brand-50 text-brand-800 border-brand-200", Icon: CheckCircle2 },
  warning: { cls: "bg-amber-50 text-amber-900 border-amber-200", Icon: AlertTriangle },
  danger: { cls: "bg-red-50 text-red-800 border-red-200", Icon: XCircle },
} as const;

export function Alert({ tone = "info", title, children, className }: { tone?: keyof typeof tones; title?: string; children?: ReactNode; className?: string }) {
  const { cls, Icon } = tones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-md border px-4 py-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
      </div>
    </div>
  );
}
