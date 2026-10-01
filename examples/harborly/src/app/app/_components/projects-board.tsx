import { Plus } from "lucide-react";
import Link from "next/link";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/labels";
import { projectsByStatus, referenceNow } from "@/lib/metrics";
import type { Db, ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { STATUS_DOT } from "./badges";
import { ProjectCard } from "./project-card";

function EmptyColumn({ status, boardEmpty }: { status: ProjectStatus; boardEmpty: boolean }) {
  if (boardEmpty && status === "planning") {
    return (
      <div className="m-1 flex flex-col items-center rounded-lg border border-dashed border-border bg-card/60 px-4 py-8 text-center">
        <p className="text-sm font-medium text-foreground">No projects yet</p>
        <p className="mt-1 text-[13px] text-pretty text-muted-foreground">
          Create your first launch plan to get started.
        </p>
        <Link
          href="/app/projects/new"
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          Create a project
        </Link>
      </div>
    );
  }
  return (
    <div className="m-1 rounded-lg border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
      No projects
    </div>
  );
}

/** The four-column board. Shared by /app/projects and the background of /app/projects/new. */
export function ProjectsBoard({ db }: { db: Db }) {
  const now = referenceNow(db);
  const columns = projectsByStatus(db.projects);
  const people = new Map(db.people.map((person) => [person.id, person]));
  const companies = new Map(db.companies.map((company) => [company.id, company.name]));
  const boardEmpty = db.projects.length === 0;

  return (
    <div
      data-demovie="projects-board"
      className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0"
    >
      <div className="grid snap-x snap-mandatory auto-cols-[minmax(272px,1fr)] grid-flow-col gap-4 lg:snap-none lg:grid-flow-row lg:grid-cols-4">
        {STATUS_ORDER.map((status) => (
          <section
            key={status}
            aria-labelledby={`column-${status}`}
            className="flex min-w-0 snap-start flex-col self-start rounded-xl bg-muted/60 p-1.5 ring-1 ring-border/70 ring-inset dark:bg-white/[0.025]"
          >
            <div className="flex items-center justify-between px-2.5 pt-1.5 pb-2">
              <h2 id={`column-${status}`} className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                <span aria-hidden="true" className={cn("size-2 rounded-full", STATUS_DOT[status])} />
                {STATUS_LABEL[status]}
              </h2>
              <span className="min-w-6 rounded-full bg-background px-2 py-0.5 text-center text-xs font-medium tabular-nums text-muted-foreground ring-1 ring-border dark:bg-white/5">
                {columns[status].length}
              </span>
            </div>
            {columns[status].length > 0 ? (
              <ul className="flex flex-col gap-2 p-1">
                {columns[status].map((project) => (
                  <li key={project.id}>
                    <ProjectCard
                      project={project}
                      owner={people.get(project.ownerId)}
                      customer={(project.customerId && companies.get(project.customerId)) || db.workspace.name}
                      now={now}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyColumn status={status} boardEmpty={boardEmpty} />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
