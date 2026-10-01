import { ListChecks, SquareKanban, UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth";
import { isActive, teamWorkload } from "@/lib/metrics";
import { EmptyState } from "../_components/empty-state";

export const metadata: Metadata = { title: "Team · Harborly" };

function workloadLabel(load: number): string {
  if (load >= 85) return "High";
  if (load >= 40) return "Balanced";
  return "Light";
}

export default async function TeamPage() {
  const { db, person: me } = await requireUser();
  const rows = teamWorkload(db);
  const openItems = rows.reduce((sum, row) => sum + row.openItems, 0);
  const stats = [
    { label: "Members", value: db.people.length, icon: Users },
    { label: "Active projects", value: db.projects.filter(isActive).length, icon: SquareKanban },
    { label: "Open checklist items", value: openItems, icon: ListChecks },
  ];

  return (
    <div className="space-y-6">
      <section aria-label="Team summary" className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="flex items-center gap-4 p-5">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <stat.icon aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">{stat.value}</p>
              <p className="text-[13px] text-muted-foreground">{stat.label}</p>
            </div>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Members</CardTitle>
            <CardDescription>Everyone in {db.workspace.name}, and how much is on their plate</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-y border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Role
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Email
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    Active projects
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Workload
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ person, activeProjects, load }) => (
                  <tr key={person.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={person.name} color={person.avatarColor} />
                        <span className="font-medium text-foreground">{person.name}</span>
                        {person.id === me.id ? <Badge variant="neutral">You</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{person.role}</td>
                    <td className="px-4 py-3 text-muted-foreground">{person.email}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{activeProjects}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Progress
                          value={load}
                          tone={load >= 85 ? "warning" : "primary"}
                          aria-label={`${person.name} workload`}
                          className="w-32"
                        />
                        <span className="w-9 text-right text-xs tabular-nums text-foreground">{load}%</span>
                        <span className="text-xs text-muted-foreground">{workloadLabel(load)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {db.people.length <= 1 ? (
            <EmptyState
              icon={UserPlus}
              title="It’s just you so far"
              description="Invite your teammates to plan launches together and balance the workload."
              className="mx-5 mt-4 mb-3 py-8"
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
