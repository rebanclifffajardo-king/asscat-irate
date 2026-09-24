import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 shadow-sm",
  secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 active:bg-gray-100 shadow-sm",
  danger: "bg-lte-danger text-white hover:bg-red-700 shadow-sm",
  warning: "bg-lte-warning text-gray-900 hover:bg-amber-400 shadow-sm",
  info: "bg-lte-info text-white hover:bg-cyan-700 shadow-sm",
  ghost: "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
  link: "text-brand-600 hover:text-brand-700 hover:underline px-0 h-auto",
} as const;

const sizes = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-base gap-2",
  icon: "h-9 w-9 justify-center",
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-semibold transition-colors select-none",
        "disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function buttonClasses(variant: keyof typeof variants = "primary", size: keyof typeof sizes = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-md font-semibold transition-colors select-none",
    variants[variant],
    sizes[size],
    className,
  );
}
