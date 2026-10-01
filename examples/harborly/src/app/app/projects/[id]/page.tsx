import { Check } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { formatLongDate, toDateOnly } from "@/lib/format";
import { burnup, referenceNow } from "@/lib/metrics";
import type { Milestone } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ActivityFeed } from "../../_components/activity-feed";
import { HealthBadge, StatusBadge } from "../../_components/badges";
import { BurnupChart } from "../../_components/charts";
import { type Assignee, ChecklistCard } from "./checklist-card";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const project = (await readDb()).projects.find((candidate) => candidate.id === id);
  return { title: project ? `${project.name} · Harborly` : "Project not found · Harborly" };
}

function ProgressRing({ value }: { value: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="size-16 -rotate-90">
      <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="6" className="stroke-muted dark:stroke-white/10" />
      <circle
        cx="32"
        cy="32"
        r={radius}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - value / 100)}
        className={value === 100 ? "stroke-emerald-500" : "stroke-primary"}
      />
    </svg>
  );
}

type MilestoneState = "done" | "next" | "upcoming" | "overdue";

function milestoneStates(milestones: Milestone[], today: string): MilestoneState[] {
  const nextIndex = milestones.findIndex((milestone) => !milestone.done);
  return milestones.map((milestone, index) => {
    if (milestone.done) return "done";
    if (milestone.date < today) return "overdue";
    return index === nextIndex ? "next" : "upcoming";
  });
}

const STATE_LABEL: Record<MilestoneState, string> = {
  done: "Done",
  next: "Up next",
  upcoming: "Upcoming",
  overdue: "Overdue",
};

export default async function ProjectPage({ params }: PageProps) {
  const { id } = await params;
  const { db } = await requireUser();
  const project = db.projects.find((candidate) => candidate.id === id);
  if (!project) notFound();

  const now = referenceNow(db);
  const people = new Map(db.people.map((person) => [person.id, person]));
  const owner = people.get(project.ownerId);
  const customer =
    (project.customerId && db.companies.find((company) => company.id === project.customerId)?.name) ||
    db.workspace.name;
  const assignees: Record<string, Assignee> = Object.fromEntries(
    db.people.map((person) => [person.id, { name: person.name, avatarColor: person.avatarColor }]),
  );
  const states = milestoneStates(project.milestones, toDateOnly(now));
  const reached = project.milestones.filter((milestone) => milestone.done).length;
  const burnupData = burnup(project);
  const launched = project.status === "launched" && project.launchedAt;

  return (
    <div className="space-y-6">
      <section
        data-demovie="project-header"
        aria-labelledby="project-title"
        className="rounded-xl border border-border bg-card p-6 shadow-[0_1px_2px_0_rgb(15_23_42/0.04)] dark:shadow-none"
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={project.status} />
              <HealthBadge health={project.health} />
            </div>
            <h1 id="project-title" className="mt-3 text-2xl font-semibold tracking-tight">
              {project.name}
            </h1>
            <p className="mt-1.5 text-sm text-pretty text-muted-foreground">{project.summary}</p>
          </div>
          <div className="flex items-center gap-3">
            <ProgressRing value={project.progress} />
            <div>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">{project.progress}%</p>
              <p className="text-xs text-muted-foreground">complete</p>
            </div>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-5 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Owner</dt>
            <dd className="mt-1.5 flex items-center gap-2 text-sm font-medium">
              {owner ? <Avatar name={owner.name} color={owner.avatarColor} size="xs" /> : null}
              {owner?.name ?? "Unassigned"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{launched ? "Launched" : "Due date"}</dt>
            <dd className="mt-1.5 text-sm font-medium">
              {launched && project.launchedAt
                ? formatLongDate(project.launchedAt)
                : project.dueDate
                  ? formatLongDate(project.dueDate)
                  : "Not set"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Customer</dt>
            <dd className="mt-1.5 text-sm font-medium">{customer}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Started</dt>
            <dd className="mt-1.5 text-sm font-medium">{formatLongDate(project.startDate)}</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <ChecklistCard projectId={project.id} items={project.checklist} assignees={assignees} />

          <Card data-testid="project-velocity">
            <CardHeader>
              <div>
                <CardTitle>Burn-up</CardTitle>
                <CardDescription>
                  {project.dueDate
                    ? `Progress against the plan to ${formatLongDate(project.dueDate)}`
                    : "Progress over time"}
                </CardDescription>
              </div>
              <ul aria-hidden="true" className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
                <li className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3.5 rounded-full bg-primary" />
                  Completed
                </li>
                {project.dueDate ? (
                  <li className="flex items-center gap-1.5">
                    <span className="w-3.5 border-t-[1.5px] border-dashed border-muted-foreground" />
                    Planned
                  </li>
                ) : null}
              </ul>
            </CardHeader>
            <CardContent>
              <BurnupChart data={burnupData} className="h-60" />
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card data-testid="project-timeline">
            <CardHeader>
              <div>
                <CardTitle>Timeline</CardTitle>
                <CardDescription>
                  {reached} of {project.milestones.length} milestones reached
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ol>
                {project.milestones.map((milestone, index) => {
                  const state = states[index] ?? "upcoming";
                  const last = index === project.milestones.length - 1;
                  return (
                    <li key={milestone.id} className="relative flex gap-3 pb-5 last:pb-0">
                      {last ? null : (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute top-6 bottom-0 left-[9.5px] w-px",
                            state === "done" ? "bg-primary/40" : "bg-border",
                          )}
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "relative z-10 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                          state === "done" && "bg-primary text-primary-foreground",
                          state === "next" && "bg-background ring-2 ring-primary",
                          state === "overdue" && "bg-background ring-2 ring-rose-500",
                          state === "upcoming" && "bg-background ring-1 ring-border",
                        )}
                      >
                        {state === "done" ? <Check className="size-3" strokeWidth={3} /> : null}
                        {state === "next" ? <span className="size-2 rounded-full bg-primary" /> : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm font-medium", state === "upcoming" && "text-muted-foreground")}>
                          {milestone.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <time dateTime={milestone.date}>{formatLongDate(milestone.date)}</time>
                          <span
                            className={cn(
                              "ml-1.5",
                              state === "next" && "font-medium text-primary",
                              state === "overdue" && "font-medium text-rose-600 dark:text-rose-400",
                            )}
                          >
                            · {STATE_LABEL[state]}
                          </span>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Activity</CardTitle>
                <CardDescription>Recent updates on this project</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <ActivityFeed db={db} limit={5} projectId={project.id} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
