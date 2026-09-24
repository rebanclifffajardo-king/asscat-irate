import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * ASSCAT iRATE brand mark: three stacked evaluation sheets (from the original
 * logo) with the cyan→green gradient, refined geometry and a rating star.
 */
export function LogoMark({ className, title = "ASSCAT iRATE" }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1fb5a6" />
          <stop offset="1" stopColor="#28a745" />
        </linearGradient>
        <linearGradient id={`${id}-star`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#53b76f" />
          <stop offset="1" stopColor="#1c7430" />
        </linearGradient>
      </defs>
      <rect x="23" y="5" width="33" height="42" rx="6" fill="#fff" stroke="#9ada7a" strokeWidth="3.5" />
      <rect x="16" y="10.5" width="33" height="42" rx="6" fill="#fff" stroke="#5cc26f" strokeWidth="3.5" />
      <rect x="9" y="16" width="33" height="42" rx="6" fill="#fff" stroke={`url(#${id}-front)`} strokeWidth="3.5" />
      <path
        d="M25.5 29.2 L27.6 34.4 L33.2 34.8 L28.9 38.4 L30.3 43.9 L25.5 40.9 L20.7 43.9 L22.1 38.4 L17.8 34.8 L23.4 34.4 Z"
        fill={`url(#${id}-star)`}
        stroke={`url(#${id}-star)`}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type LogoProps = {
  className?: string;
  /** stacked = logo lockup (login/reports); inline = single line (sidebar/header) */
  variant?: "stacked" | "inline";
  /** light text for dark backgrounds */
  tone?: "dark" | "light";
  markClassName?: string;
};

export function Logo({ className, variant = "stacked", tone = "dark", markClassName }: LogoProps) {
  const textColor = tone === "light" ? "text-white" : "text-[#2f3337]";
  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-center gap-2", className)}>
        <LogoMark className={cn("h-8 w-8 shrink-0", markClassName)} />
        <span className={cn("font-display text-lg font-extrabold tracking-tight leading-none", textColor)}>
          ASSCAT <span className="text-brand-400">iRATE</span>
        </span>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <LogoMark className={cn("h-16 w-16 shrink-0", markClassName)} />
      <span className="flex flex-col font-display font-extrabold leading-[0.95] tracking-tight">
        <span className={cn("text-[1.9rem]", textColor)}>ASSCAT</span>
        <span className="text-[1.9rem] bg-gradient-to-r from-teal-brand to-brand-500 bg-clip-text text-transparent">
          iRATE
        </span>
      </span>
    </span>
  );
}
