"use client";

import { ChevronRight, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { titleForPath } from "./nav-items";

/** Top bar of the app shell: page title (or breadcrumb), search, theme toggle and, on projects pages, "New project". */
export function AppHeader({ projectNames }: { projectNames: Record<string, string> }) {
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);
  const onProjects = pathname === "/app/projects" || pathname.startsWith("/app/projects/");
  const detailId = /^\/app\/projects\/([^/]+)$/.exec(pathname)?.[1];
  const projectName = detailId && detailId !== "new" ? projectNames[decodeURIComponent(detailId)] : undefined;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="z-20 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6 lg:sticky lg:top-0 lg:px-8">
      {projectName ? (
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex min-w-0 items-center gap-1.5 text-sm">
            <li>
              <Link href="/app/projects" className="text-muted-foreground transition-colors hover:text-foreground">
                Projects
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="size-4 text-muted-foreground/60" />
            </li>
            <li className="min-w-0">
              <span aria-current="page" className="block truncate font-medium text-foreground">
                {projectName}
              </span>
            </li>
          </ol>
        </nav>
      ) : (
        <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{titleForPath(pathname)}</h1>
      )}

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden md:block">
          <label htmlFor="app-search" className="sr-only">
            Search projects
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={searchRef}
            id="app-search"
            type="search"
            placeholder="Search projects…"
            autoComplete="off"
            className="h-9 w-56 bg-muted/40 pr-11 pl-8 xl:w-64"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border bg-background px-1.5 py-px text-[10px] font-medium text-muted-foreground"
          >
            ⌘K
          </span>
        </div>
        <ThemeToggle />
        {onProjects ? (
          <Link href="/app/projects/new" data-testid="new-project" className={buttonVariants({ size: "sm" })}>
            <Plus aria-hidden="true" className="size-4" />
            New project
          </Link>
        ) : null}
      </div>
    </header>
  );
}
