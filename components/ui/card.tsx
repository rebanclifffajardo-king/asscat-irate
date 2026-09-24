import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const outlines = {
  none: "",
  brand: "border-t-[3px] border-t-brand-500",
  info: "border-t-[3px] border-t-lte-info",
  warning: "border-t-[3px] border-t-lte-warning",
  danger: "border-t-[3px] border-t-lte-danger",
  primary: "border-t-[3px] border-t-lte-primary",
} as const;

export function Card({
  className, outline = "none", children,
}: { className?: string; outline?: keyof typeof outlines; children: ReactNode }) {
  return (
    <section className={cn("rounded-md bg-white shadow-card", outlines[outline], className)}>{children}</section>
  );
}

export function CardHeader({
  title, description, actions, className, icon,
}: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <header className={cn("flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3", className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800">
          {icon}
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("p-4", className)}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <footer className={cn("border-t border-gray-200 bg-gray-50/60 px-4 py-3 rounded-b-md", className)}>{children}</footer>;
}
