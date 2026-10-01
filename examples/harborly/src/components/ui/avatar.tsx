import { initials } from "@/lib/format";
import type { AvatarColor } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLORS: Record<AvatarColor, string> = {
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
  cyan: "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-200",
};

const FALLBACK_ORDER: AvatarColor[] = ["blue", "violet", "emerald", "amber", "rose", "cyan", "indigo", "orange"];

const SIZES = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
} as const;

function colorFor(name: string, color: AvatarColor | undefined): AvatarColor {
  if (color) return color;
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FALLBACK_ORDER[hash % FALLBACK_ORDER.length] ?? "blue";
}

export interface AvatarProps {
  name: string;
  color?: AvatarColor;
  size?: keyof typeof SIZES;
  /** Adds screen-reader text; leave unset when the name is already shown next to the avatar. */
  label?: string;
  className?: string;
}

export function Avatar({ name, color, size = "md", label, className }: AvatarProps) {
  return (
    <span
      title={label}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-tight ring-2 ring-card",
        SIZES[size],
        COLORS[colorFor(name, color)],
        className,
      )}
    >
      <span aria-hidden="true">{initials(name)}</span>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
