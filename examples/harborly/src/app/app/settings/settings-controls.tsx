"use client";

import { Check, Copy, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { setThemePreference, type ThemePreference, useThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

function useFlag(durationMs: number): [boolean, () => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    const timer = window.setTimeout(() => setOn(false), durationMs);
    return () => window.clearTimeout(timer);
  }, [on, durationMs]);
  return [on, () => setOn(true)];
}

export function CopyButton({ value }: { value: string }) {
  const [copied, flash] = useFlag(2000);
  return (
    <Button
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          flash();
        } catch {
          // Clipboard access can be denied; the key stays selectable in the input.
        }
      }}
    >
      {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/** The profile form is a fixture: saving only acknowledges, so the redaction test values never change. */
export function SaveButton() {
  const [saved, flash] = useFlag(2000);
  return (
    <div className="flex items-center gap-3">
      {saved ? (
        <span role="status" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Check aria-hidden="true" className="size-4 text-emerald-600" />
          Changes saved
        </span>
      ) : null}
      <Button size="sm" onClick={flash}>
        Save changes
      </Button>
    </div>
  );
}

export function NotificationSetting({
  id,
  label,
  description,
  defaultChecked,
}: {
  id: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <p id={`${id}-description`} className="mt-0.5 text-[13px] text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch id={id} defaultChecked={defaultChecked} aria-describedby={`${id}-description`} />
    </div>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Light / Dark / System, wired to the same storage and class as the header toggle. */
export function AppearanceControl() {
  const preference = useThemePreference();
  return (
    <fieldset>
      <legend className="sr-only">Theme</legend>
      <div className="inline-flex rounded-lg border border-border bg-muted/50 p-1 dark:bg-white/[0.03]">
        {THEME_OPTIONS.map((option) => (
          <label key={option.value} className="relative">
            <input
              type="radio"
              name="theme"
              value={option.value}
              checked={preference === option.value}
              onChange={() => setThemePreference(option.value)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex h-8 cursor-pointer items-center gap-2 rounded-md px-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                "peer-checked:bg-background peer-checked:font-medium peer-checked:text-foreground peer-checked:shadow-xs peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/40 dark:peer-checked:bg-white/10",
              )}
            >
              <option.icon aria-hidden="true" className="size-4" />
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
