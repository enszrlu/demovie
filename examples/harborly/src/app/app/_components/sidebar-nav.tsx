"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActivePath, NAV_ITEMS } from "./nav-items";

export function SidebarNav({
  counts,
  onNavigate,
  className,
}: {
  counts?: Partial<Record<string, number>>;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <ul className={cn("space-y-0.5", className)}>
      {NAV_ITEMS.map((item) => {
        const active = isActivePath(pathname, item.href);
        const count = counts?.[item.href];
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-9 items-center gap-3 rounded-md px-2.5 text-sm transition-colors",
                active
                  ? "bg-primary/10 font-medium text-primary dark:bg-primary/15"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
              )}
            >
              <item.icon aria-hidden="true" className="size-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {count ? (
                // Hidden from the accessible name so the link stays "Projects" as counts change.
                <span
                  aria-hidden="true"
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
