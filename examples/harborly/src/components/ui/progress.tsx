import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  primary: "[&::-moz-progress-bar]:bg-primary [&::-webkit-progress-value]:bg-primary",
  success: "[&::-moz-progress-bar]:bg-emerald-500 [&::-webkit-progress-value]:bg-emerald-500",
  warning: "[&::-moz-progress-bar]:bg-amber-500 [&::-webkit-progress-value]:bg-amber-500",
  danger: "[&::-moz-progress-bar]:bg-rose-500 [&::-webkit-progress-value]:bg-rose-500",
  neutral: "[&::-moz-progress-bar]:bg-foreground/70 [&::-webkit-progress-value]:bg-foreground/70",
} as const;

export type ProgressTone = keyof typeof TONES;

/** A styled native <progress>; pass an aria-label so it has an accessible name. */
export function Progress({
  value,
  max = 100,
  tone = "primary",
  className,
  ...props
}: Omit<ComponentProps<"progress">, "value"> & { value: number; tone?: ProgressTone }) {
  return (
    <progress
      value={value}
      max={max}
      className={cn(
        "block h-1.5 w-full appearance-none overflow-hidden rounded-full border-0 bg-muted [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:rounded-full dark:bg-white/10 dark:[&::-webkit-progress-bar]:bg-white/10",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
