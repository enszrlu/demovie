import { CalendarCheck, ChartColumn, Gauge, Rocket, Timer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { formatLongDate, formatNumber, formatShortDate } from "@/lib/format";
import { dashboardKpis, launchedProjects } from "@/lib/metrics";
import { CycleTimeChart, VelocityAreaChart } from "../_components/charts";
import { EmptyState } from "../_components/empty-state";

export const metadata: Metadata = { title: "Reports · Harborly" };

export default async function ReportsPage() {
  const { db } = await requireUser();
  const kpis = dashboardKpis(db);
  const launched = launchedProjects(db);
  const people = new Map(db.people.map((person) => [person.id, person]));
  const companies = new Map(db.companies.map((company) => [company.id, company.name]));
  const velocity = db.velocity.map((week) => ({
    label: formatShortDate(week.weekStart),
    completed: week.completed,
    committed: week.committed,
  }));
  const throughput = db.velocity.reduce((sum, week) => sum + week.completed, 0);
  const avgDuration = launched.length
    ? launched.reduce((sum, row) => sum + row.durationDays, 0) / launched.length
    : null;
  const onTime = launched.filter((row) => row.daysLate === 0).length;

  const stats = [
    {
      label: "Throughput",
      value: db.velocity.length ? `${throughput}` : "—",
      unit: db.velocity.length ? `pts in ${db.velocity.length} weeks` : "",
      icon: ChartColumn,
    },
    {
      label: "Avg. velocity",
      value: kpis.avgVelocity !== null ? formatNumber(kpis.avgVelocity, 1) : "—",
      unit: kpis.avgVelocity !== null ? "pts / week" : "",
      icon: Gauge,
    },
    {
      label: "Cycle time",
      value: avgDuration !== null ? formatNumber(avgDuration) : "—",
      unit: avgDuration !== null ? "avg. days, kickoff to launch" : "",
      icon: Timer,
    },
    {
      label: "On-time launches",
      value: launched.length ? `${Math.round((onTime / launched.length) * 100)}%` : "—",
      unit: launched.length ? `${onTime} of ${launched.length} launches` : "",
      icon: CalendarCheck,
    },
  ];

  return (
    <div className="space-y-6">
      <section aria-label="Report summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-medium text-muted-foreground">{stat.label}</h2>
              <stat.icon aria-hidden="true" className="size-4 text-muted-foreground/80" />
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{stat.value}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{stat.unit || "No data yet"}</p>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="min-w-0 xl:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Velocity</CardTitle>
              <CardDescription>Points completed vs. committed, last 12 weeks</CardDescription>
            </div>
            {velocity.length > 0 ? (
              <ul aria-hidden="true" className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
                <li className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3.5 rounded-full bg-primary" />
                  Completed
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-3.5 border-t-[1.5px] border-dashed border-muted-foreground" />
                  Committed
                </li>
              </ul>
            ) : null}
          </CardHeader>
          <CardContent>
            {velocity.length > 0 ? (
              <VelocityAreaChart data={velocity} className="h-72" />
            ) : (
              <EmptyState
                icon={ChartColumn}
                title="No velocity data yet"
                description="Weekly velocity appears once your team completes work."
                className="h-72"
              />
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Cycle time</CardTitle>
              <CardDescription>Average days a project spends in each stage</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {db.cycleTimes.length > 0 ? (
              <CycleTimeChart data={db.cycleTimes} className="h-72" />
            ) : (
              <EmptyState
                icon={Timer}
                title="No cycle time yet"
                description="Cycle time is measured as projects move through stages."
                className="h-72"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Launched projects</CardTitle>
            <CardDescription>Everything shipped, newest first</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {launched.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-y border-border bg-muted/40 text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Project
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Customer
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Owner
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Launched
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      Duration
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Delivery
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {launched.map(({ project, durationDays, daysLate }) => {
                    const owner = people.get(project.ownerId);
                    return (
                      <tr key={project.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-5 py-3">
                          <Link
                            href={`/app/projects/${project.id}`}
                            className="inline-flex items-center gap-2 font-medium text-foreground hover:underline"
                          >
                            <Rocket aria-hidden="true" className="size-3.5 text-muted-foreground" />
                            {project.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {(project.customerId && companies.get(project.customerId)) || db.workspace.name}
                        </td>
                        <td className="px-4 py-3">
                          {owner ? (
                            <span className="inline-flex items-center gap-2 text-muted-foreground">
                              <Avatar name={owner.name} color={owner.avatarColor} size="xs" />
                              {owner.name}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">
                          {project.launchedAt ? formatLongDate(project.launchedAt) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{durationDays} days</td>
                        <td className="px-5 py-3">
                          {daysLate === 0 ? (
                            <Badge variant="success">On time</Badge>
                          ) : (
                            <Badge variant="warning">{daysLate} days late</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Rocket}
              title="No launches yet"
              description="Launched projects and how long they took will be listed here."
              className="mx-5 mb-3 py-8"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
