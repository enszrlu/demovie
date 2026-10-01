import { LogOut } from "lucide-react";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import type { Person, Workspace } from "@/lib/types";
import { SidebarNav } from "./sidebar-nav";

export interface QuarterSummary {
  label: string;
  shipped: number;
  planned: number;
}

export function WorkspaceBadge({ workspace }: { workspace: Workspace }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-background px-2.5 py-2 shadow-xs dark:bg-white/[0.03]">
      <span
        aria-hidden="true"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-900"
      >
        {workspace.name
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()}
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[13px] font-medium text-foreground">{workspace.name}</p>
        <p className="truncate text-xs text-muted-foreground">{workspace.plan} plan</p>
      </div>
    </div>
  );
}

export function LogoutLink({ className }: { className?: string }) {
  return (
    <a
      href="/logout"
      className={
        className ??
        "flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      }
    >
      <LogOut aria-hidden="true" className="size-4" />
      Log out
    </a>
  );
}

export function AppSidebar({
  workspace,
  person,
  activeProjects,
  quarter,
}: {
  workspace: Workspace;
  person: Person;
  activeProjects: number;
  quarter: QuarterSummary;
}) {
  return (
    // The aside spans the full page height (so full-page screenshots stay intact); its content sticks.
    <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
      <div className="sticky top-0 flex h-dvh flex-col">
        <div className="flex h-16 items-center px-5">
          <Logo href="/app" />
        </div>
        <div className="px-3">
          <WorkspaceBadge workspace={workspace} />
        </div>
        <nav aria-label="App" className="mt-5 px-3">
          <SidebarNav counts={{ "/app/projects": activeProjects }} />
        </nav>

        <div className="mt-auto space-y-3 p-3">
          <div className="rounded-lg border border-sidebar-border bg-background p-3 dark:bg-white/[0.03]">
            <p className="text-xs font-medium text-foreground">{quarter.label} launches</p>
            {quarter.planned > 0 ? (
              <>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {quarter.shipped} of {quarter.planned} shipped
                </p>
                <Progress
                  value={quarter.shipped}
                  max={quarter.planned}
                  aria-label={`${quarter.label} launches shipped`}
                  className="mt-2.5"
                />
              </>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground">No launches planned yet</p>
            )}
          </div>
          <div className="border-t border-sidebar-border pt-3">
            <div className="flex items-center gap-3 px-1.5 py-1">
              <Avatar name={person.name} color={person.avatarColor} />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-medium text-foreground">{person.name}</p>
                <p className="truncate text-xs text-muted-foreground">{person.role}</p>
              </div>
            </div>
            <LogoutLink />
          </div>
        </div>
      </div>
    </aside>
  );
}
