import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, htmlFor, children, ...props }: ComponentProps<"label">) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "flex select-none items-center gap-2 text-[13px] font-medium leading-none text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </label>
  );
}
