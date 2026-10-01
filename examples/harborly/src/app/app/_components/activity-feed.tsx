import { MessageSquareText } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import type { ActivityItem, Db, Person, Project } from "@/lib/types";
import { EmptyState } from "./empty-state";
import { RelativeTime } from "./relative-time";

function describe(item: ActivityItem, actor: ReactNode, project: ReactNode): ReactNode {
  const quoted = <span className="text-foreground">“{item.detail}”</span>;
  switch (item.type) {
    case "completed_item":
      return (
        <>
          {actor} completed {quoted} in {project}
        </>
      );
    case "created_project":
      return (
        <>
          {actor} created {project}
        </>
      );
    case "moved_project":
      return (
        <>
          {actor} moved {project} to {item.detail}
        </>
      );
    case "commented":
      return (
        <>
          {actor} commented on {project}
        </>
      );
    case "health_changed":
      return (
        <>
          {actor} marked {project} as {item.detail?.toLowerCase()}
        </>
      );
    case "milestone_reached":
      return (
        <>
          {actor} reached {quoted} in {project}
        </>
      );
    case "launched_project":
      return (
        <>
          {actor} launched {project}
        </>
      );
  }
}

/** Newest-first activity, optionally for a single project. */
export function ActivityFeed({ db, limit, projectId }: { db: Db; limit: number; projectId?: string }) {
  const people = new Map<string, Person>(db.people.map((person) => [person.id, person]));
  const projects = new Map<string, Project>(db.projects.map((project) => [project.id, project]));
  const items = db.activity
    .filter((item) => !projectId || item.projectId === projectId)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareText}
        title="No activity yet"
        description="Updates from your team will show up here as work moves."
        className="py-8"
      />
    );
  }

  return (
    <ol className="space-y-4">
      {items.map((item) => {
        const actor = people.get(item.actorId);
        const project = projects.get(item.projectId);
        const actorName = <span className="font-medium text-foreground">{actor?.name ?? "Someone"}</span>;
        const projectName = project ? (
          <Link href={`/app/projects/${project.id}`} className="font-medium text-foreground hover:underline">
            {project.name}
          </Link>
        ) : (
          <span className="text-foreground">a removed project</span>
        );
        return (
          <li key={item.id} className="flex gap-3">
            <Avatar name={actor?.name ?? "?"} color={actor?.avatarColor} size="sm" className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-5 text-muted-foreground">{describe(item, actorName, projectName)}</p>
              <RelativeTime value={item.at} className="text-xs text-muted-foreground/80" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
