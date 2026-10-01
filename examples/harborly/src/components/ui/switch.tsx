"use client";

import { type ComponentProps, useState } from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps extends Omit<ComponentProps<"button">, "onChange" | "type" | "role"> {
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function Switch({ defaultChecked = false, onCheckedChange, className, onClick, ...props }: SwitchProps) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        setChecked(!checked);
        onCheckedChange?.(!checked);
      }}
      className={cn(
        "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5 outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40",
        checked ? "bg-primary" : "bg-input dark:bg-white/15",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "block size-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}
