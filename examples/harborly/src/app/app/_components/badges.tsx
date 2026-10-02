import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { HEALTH_LABEL, STATUS_LABEL } from "@/lib/labels";
import type { ProjectHealth, ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const HEALTH_VARIANT: Record<ProjectHealth, BadgeVariant> = {
  "on-track": "success",
  "at-risk": "warning",
  "off-track": "danger",
};

/** An icon per health, so the badge reads at a glance and without relying on color. */
function HealthIcon({ health }: { health: ProjectHealth }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className="size-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {health === "on-track" ? (
        <path d="M2.5 6.2 5 8.5l4.5-5" />
      ) : health === "at-risk" ? (
        <path d="M6 2.5v4.2M6 9.4v.1" />
      ) : (
        <path d="m3 3 6 6M9 3 3 9" />
      )}
    </svg>
  );
}

export const STATUS_DOT: Record<ProjectStatus, string> = {
  planning: "bg-slate-400 dark:bg-slate-500",
  "in-progress": "bg-blue-500",
  review: "bg-violet-500",
  launched: "bg-emerald-500",
};

/** `demovieId` becomes a `data-demovie` id, so videos can target one project's badge (e.g. `dm:health-prj_android`). */
export function HealthBadge({
  health,
  className,
  demovieId,
}: {
  health: ProjectHealth;
  className?: string;
  demovieId?: string;
}) {
  return (
    <Badge variant={HEALTH_VARIANT[health]} className={className} data-demovie={demovieId}>
      <HealthIcon health={health} />
      {HEALTH_LABEL[health]}
    </Badge>
  );
}

export function StatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <Badge variant="outline" className={className}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
      {STATUS_LABEL[status]}
    </Badge>
  );
}
