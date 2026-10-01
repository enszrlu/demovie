"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { Person, Workspace } from "@/lib/types";
import { SidebarNav } from "./sidebar-nav";

const LOGOUT_CLASS =
  "inline-flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground";

/** Below the lg breakpoint the sidebar collapses into this top bar with a dropdown menu. */
export function MobileNav({
  workspace,
  person,
  activeProjects,
}: {
  workspace: Workspace;
  person: Person;
  activeProjects: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md lg:hidden">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <Logo href="/app" />
        <div className="flex items-center gap-2">
          <span className="hidden text-[13px] text-muted-foreground sm:inline">{workspace.name}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
          </Button>
        </div>
      </div>
      {open ? (
        <nav
          id="mobile-menu"
          aria-label="App"
          className="border-t border-border px-4 pt-3 pb-4 sm:px-6 motion-safe:animate-fade-in"
        >
          <SidebarNav counts={{ "/app/projects": activeProjects }} onNavigate={() => setOpen(false)} />
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <div className="flex items-center gap-3">
              <Avatar name={person.name} color={person.avatarColor} size="sm" />
              <div className="leading-tight">
                <p className="text-sm font-medium">{person.name}</p>
                <p className="text-xs text-muted-foreground">{person.role}</p>
              </div>
            </div>
            <a href="/logout" className={LOGOUT_CLASS}>
              Log out
            </a>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
