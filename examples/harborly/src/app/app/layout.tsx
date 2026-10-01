import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { dashboardKpis } from "@/lib/metrics";
import { AppHeader } from "./_components/app-header";
import { AppSidebar } from "./_components/app-sidebar";
import { MobileNav } from "./_components/mobile-nav";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { db, person } = await requireUser();
  const kpis = dashboardKpis(db);
  const projectNames = Object.fromEntries(db.projects.map((project) => [project.id, project.name]));

  return (
    <div className="flex min-h-dvh">
      <AppSidebar
        workspace={db.workspace}
        person={person}
        activeProjects={kpis.activeProjects}
        quarter={{
          label: kpis.quarterLabel.split(" ")[0] ?? kpis.quarterLabel,
          shipped: kpis.launchedThisQuarter,
          planned: kpis.launchedThisQuarter + kpis.scheduledThisQuarter,
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav workspace={db.workspace} person={person} activeProjects={kpis.activeProjects} />
        <AppHeader projectNames={projectNames} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
