import {
  ChartColumn,
  CircleCheck,
  Gauge,
  type LucideIcon,
  Rocket,
  SquareKanban,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth";
import { formatNumber, formatShortDate } from "@/lib/format";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/labels";
import { dashboardKpis, upcomingLaunches } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { ActivityFeed } from "./_components/activity-feed";
import { HealthBadge, STATUS_DOT } from "./_components/badges";
import { VelocityBarChart } from "./_components/charts";
import { EmptyState } from "./_components/empty-state";

export const metadata: Metadata = { title: "Dashboard · Harborly" };

function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  footer,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  footer: ReactNode;
}) {
  return (
    <Card data-testid="kpi-card" className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-medium text-muted-foreground">{label}</h2>
        <Icon aria-hidden="true" className="size-4 text-muted-foreground/80" />
      </div>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
      </p>
      <div className="mt-2 flex min-h-5 items-center gap-1.5 text-[13px] text-muted-foreground">{footer}</div>
    </Card>
  );
}

function Trend({ percent }: { percent: number }) {
  const up = percent >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium",
        up
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
          : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {up ? "+" : "−"}
      {Math.abs(percent)}%
    </span>
  );
}

export default async function DashboardPage() {
  const { db } = await requireUser();
  const kpis = dashboardKpis(db);
  const people = new Map(db.people.map((person) => [person.id, person]));
  const companies = new Map(db.companies.map((company) => [company.id, company.name]));
  const velocity = db.velocity.map((week) => ({
    label: formatShortDate(week.weekStart),
    completed: week.completed,
    committed: week.committed,
  }));
  const lastWeek = db.velocity.at(-1);
  const upcoming = upcomingLaunches(db, 4);
  const statusCounts = STATUS_ORDER.map((status) => ({
    status,
    count: db.projects.filter((project) => project.status === status).length,
  }));
  const totalProjects = db.projects.length;

  return (
    <div className="space-y-6">
      <section
        data-demovie="dashboard-kpis"
        aria-label="Key metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <KpiCard
          label="Active projects"
          value={String(kpis.activeProjects)}
          icon={SquareKanban}
          footer={
            kpis.activeProjects > 0 ? (
              <>
                <span className="font-medium text-foreground">+{kpis.startedLast30Days}</span> started in the last 30
                days
              </>
            ) : (
              "No projects yet"
            )
          }
        />
        <KpiCard
          label="On track"
          value={String(kpis.onTrack)}
          icon={CircleCheck}
          footer={
            kpis.onTrackPercent !== null ? (
              <>
                <span className="font-medium text-foreground">{kpis.onTrackPercent}%</span> of active projects
              </>
            ) : (
              "Nothing to track yet"
            )
          }
        />
        <KpiCard
          label="Launches this quarter"
          value={String(kpis.launchedThisQuarter + kpis.scheduledThisQuarter)}
          icon={Rocket}
          footer={
            <>
              <span className="font-medium text-foreground">{kpis.launchedThisQuarter} shipped</span> ·{" "}
              {kpis.scheduledThisQuarter} scheduled in {kpis.quarterLabel.split(" ")[0]}
            </>
          }
        />
        <KpiCard
          label="Avg. velocity"
          value={kpis.avgVelocity !== null ? formatNumber(kpis.avgVelocity, 1) : "—"}
          unit={kpis.avgVelocity !== null ? "pts / week" : undefined}
          icon={Gauge}
          footer={
            kpis.velocityChangePercent !== null ? (
              <>
                <Trend percent={kpis.velocityChangePercent} /> vs. previous 4 weeks
              </>
            ) : (
              "No velocity data yet"
            )
          }
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card data-testid="velocity-chart">
            <CardHeader>
              <div>
                <CardTitle>Velocity</CardTitle>
                <CardDescription>Story points completed per week, last 12 weeks</CardDescription>
              </div>
              {lastWeek ? (
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-semibold tracking-tight tabular-nums">{lastWeek.completed}</p>
                  <p className="text-xs whitespace-nowrap text-muted-foreground">pts last week</p>
                </div>
              ) : null}
            </CardHeader>
            <CardContent>
              {velocity.length > 0 ? (
                <VelocityBarChart data={velocity} className="h-72" />
              ) : (
                <EmptyState
                  icon={ChartColumn}
                  title="No velocity data yet"
                  description="Complete checklist work on a project and weekly velocity will appear here."
                  className="h-72"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Upcoming launches</CardTitle>
                <CardDescription>The next projects due to ship</CardDescription>
              </div>
              <Link href="/app/projects" className="text-[13px] font-medium text-primary hover:underline">
                View board
              </Link>
            </CardHeader>
            <CardContent className="pt-2">
              {upcoming.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="sr-only">
                    <tr>
                      <th scope="col">Project</th>
                      <th scope="col">Owner</th>
                      <th scope="col">Progress</th>
                      <th scope="col">Health</th>
                      <th scope="col">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {upcoming.map((project) => {
                      const owner = people.get(project.ownerId);
                      return (
                        <tr key={project.id}>
                          <td className="py-3 pr-4">
                            <Link
                              href={`/app/projects/${project.id}`}
                              className="font-medium text-foreground hover:underline"
                            >
                              {project.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {(project.customerId && companies.get(project.customerId)) || db.workspace.name}
                            </p>
                          </td>
                          <td className="hidden py-3 pr-4 sm:table-cell">
                            {owner ? (
                              <Avatar
                                name={owner.name}
                                color={owner.avatarColor}
                                size="sm"
                                label={`Owner: ${owner.name}`}
                              />
                            ) : null}
                          </td>
                          <td className="hidden w-48 py-3 pr-4 md:table-cell">
                            <div className="flex items-center gap-2.5">
                              <Progress
                                value={project.progress}
                                aria-label={`${project.name} progress`}
                                className="flex-1"
                              />
                              <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                                {project.progress}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <HealthBadge health={project.health} />
                          </td>
                          <td className="py-3 text-right text-[13px] whitespace-nowrap text-muted-foreground tabular-nums">
                            {project.dueDate ? formatShortDate(project.dueDate) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <EmptyState
                  icon={Rocket}
                  title="Nothing scheduled"
                  description="Projects with a launch date will be listed here."
                  className="py-8"
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card data-testid="activity-feed">
            <CardHeader>
              <div>
                <CardTitle>Activity</CardTitle>
                <CardDescription>Latest updates across {db.workspace.name}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <ActivityFeed db={db} limit={7} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Projects by status</CardTitle>
                <CardDescription>{totalProjects} projects in this workspace</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div aria-hidden="true" className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted">
                {statusCounts
                  .filter((entry) => entry.count > 0)
                  .map((entry) => (
                    <span
                      key={entry.status}
                      className={cn("h-full", STATUS_DOT[entry.status])}
                      style={{ width: `${(entry.count / totalProjects) * 100}%` }}
                    />
                  ))}
              </div>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                {statusCounts.map((entry) => (
                  <li key={entry.status} className="flex items-center gap-2.5">
                    <span aria-hidden="true" className={cn("size-2 rounded-full", STATUS_DOT[entry.status])} />
                    <span className="flex-1 text-muted-foreground">{STATUS_LABEL[entry.status]}</span>
                    <span className="font-medium tabular-nums">{entry.count}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
