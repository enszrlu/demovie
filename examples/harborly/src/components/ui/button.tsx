import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const BASE =
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const VARIANTS = {
  default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  outline:
    "border border-border bg-background text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/20 dark:hover:bg-input/40",
  ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
} as const;

const SIZES = {
  default: "h-9 px-4",
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  lg: "h-11 px-6 text-[15px]",
  icon: "size-9",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** Class names for anything that should look like a button, e.g. a Next <Link>. */
export function buttonVariants({ variant = "default", size = "default", className }: ButtonStyleProps = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ComponentProps<"button"> & ButtonStyleProps) {
  return <button type={type} className={buttonVariants({ variant, size, className })} {...props} />;
}
