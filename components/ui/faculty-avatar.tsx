import Image from "next/image";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

const sizes = { xs: 28, sm: 36, md: 48, lg: 72, xl: 112 } as const;

export function FacultyAvatar({ name, src, size = "sm", className }: {
  name: string; src?: string | null; size?: keyof typeof sizes; className?: string;
}) {
  const px = sizes[size];
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={px}
        height={px}
        className={cn("shrink-0 rounded-full object-cover ring-2 ring-white", className)}
        style={{ width: px, height: px }}
      />
    );
  }
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 ring-2 ring-white", className)}
      style={{ width: px, height: px, fontSize: Math.max(11, px * 0.36) }}
      aria-label={name}
      role="img"
    >
      {initials(name)}
    </span>
  );
}
