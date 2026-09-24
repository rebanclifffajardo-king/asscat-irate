import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({ title, description, icon, action, className }: {
  title: string; description?: ReactNode; icon?: ReactNode; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 [&>svg]:h-6 [&>svg]:w-6" aria-hidden>
        {icon ?? <Inbox />}
      </span>
      <p className="font-semibold text-gray-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
