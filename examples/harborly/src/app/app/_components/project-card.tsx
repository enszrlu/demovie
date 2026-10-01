import { CalendarDays, Rocket } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { formatShortDate, toDateOnly } from "@/lib/format";
import type { Person, Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { HealthBadge } from "./badges";

export function dueLabel(project: Project, now: Date): { text: string; overdue: boolean; launched: boolean } {
  if (project.status === "launched" && project.launchedAt) {
    return { text: `Launched ${formatShortDate(project.launchedAt)}`, overdue: false, launched: true };
  }
  if (!project.dueDate) return { text: "No due date", overdue: false, launched: false };
  return {
    text: `Due ${formatShortDate(project.dueDate)}`,
    overdue: project.dueDate < toDateOnly(now),
    launched: false,
  };
}

export function ProjectCard({
  project,
  owner,
  customer,
  now,
}: {
  project: Project;
  owner: Person | undefined;
  customer: string;
  now: Date;
}) {
  const due = dueLabel(project, now);
  const DueIcon = due.launched ? Rocket : CalendarDays;
  const ids = { name: `${project.id}-name`, details: `${project.id}-details`, meta: `${project.id}-meta` };
  return (
    <Link
      href={`/app/projects/${project.id}`}
      data-testid="project-card"
      aria-labelledby={ids.name}
      aria-describedby={`${ids.details} ${ids.meta}`}
      className="group block rounded-lg border border-border bg-card p-3.5 shadow-[0_1px_2px_0_rgb(15_23_42/0.05)] outline-none transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-md hover:shadow-slate-950/5 focus-visible:ring-[3px] focus-visible:ring-ring/40 dark:shadow-none dark:hover:border-primary/50"
    >
      <div id={ids.details} className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{customer}</span>
        <HealthBadge health={project.health} />
      </div>
      <h3 id={ids.name} className="mt-2 text-sm font-medium leading-5 text-foreground">
        {project.name}
      </h3>
      <div id={ids.meta}>
        <div className="mt-3 flex items-center gap-2.5">
          <Progress
            value={project.progress}
            tone={due.launched ? "success" : "primary"}
            aria-label={`${project.name} progress`}
            className="flex-1"
          />
          <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{project.progress}%</span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs",
              due.overdue ? "font-medium text-rose-600 dark:text-rose-400" : "text-muted-foreground",
            )}
          >
            <DueIcon aria-hidden="true" className="size-3.5" />
            {due.text}
          </span>
          {owner ? (
            <Avatar name={owner.name} color={owner.avatarColor} size="sm" label={`Owner: ${owner.name}`} />
          ) : null}
        </div>
      </div>
    </Link>
  );
}
