import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Full-viewport scrim behind a dialog. */
export function DialogOverlay({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] dark:bg-black/60", className)}
      {...props}
    />
  );
}

/** Centers its children above the overlay; the click target outside the panel. */
export function DialogPositioner({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[10vh] sm:items-center sm:pt-4",
        className,
      )}
      {...props}
    />
  );
}

export function DialogPanel({
  className,
  labelledBy,
  ...props
}: Omit<ComponentProps<"div">, "role"> & { labelledBy: string }) {
  // A div rather than <dialog>: the panel is server-rendered already open, without showModal().
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className={cn(
        "relative w-full max-w-lg rounded-xl border border-border bg-card text-card-foreground shadow-2xl shadow-slate-950/20",
        className,
      )}
      {...props}
    />
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-start justify-between gap-4 px-6 pt-6", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("text-lg font-semibold leading-7 tracking-tight", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 border-t border-border bg-muted/40 px-6 py-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
