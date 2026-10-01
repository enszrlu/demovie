import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  default: "border-transparent bg-primary text-primary-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  outline: "border-border bg-background text-foreground dark:bg-transparent",
  neutral: "border-transparent bg-muted text-muted-foreground",
  info: "border-transparent bg-blue-50 text-blue-700 ring-1 ring-blue-600/15 ring-inset dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/20",
  success:
    "border-transparent bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15 ring-inset dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
  warning:
    "border-transparent bg-amber-50 text-amber-800 ring-1 ring-amber-600/20 ring-inset dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20",
  danger:
    "border-transparent bg-rose-50 text-rose-700 ring-1 ring-rose-600/15 ring-inset dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20",
} as const;

export type BadgeVariant = keyof typeof VARIANTS;

export function Badge({
  className,
  variant = "secondary",
  ...props
}: ComponentProps<"span"> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium [&_svg]:size-3",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
