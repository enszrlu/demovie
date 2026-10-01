"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleTheme, useThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Sun/moon button. The icon swap is pure CSS (`dark:`), so server and client markup always match. */
export function ThemeToggle({ className }: { className?: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      title="Toggle theme"
      data-testid="theme-toggle"
      onClick={toggleTheme}
      className={cn("text-muted-foreground hover:text-foreground", className)}
    >
      <Sun aria-hidden="true" className="size-[18px] dark:hidden" />
      <Moon aria-hidden="true" className="hidden size-[18px] dark:block" />
    </Button>
  );
}

/** Mounted once in the root layout: keeps a "system" preference in sync with OS changes and other tabs. */
export function ThemeSync() {
  useThemePreference();
  return null;
}
