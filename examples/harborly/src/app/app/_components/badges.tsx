import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { HEALTH_LABEL, STATUS_LABEL } from "@/lib/labels";
import type { ProjectHealth, ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const HEALTH_VARIANT: Record<ProjectHealth, BadgeVariant> = {
  "on-track": "success",
  "at-risk": "warning",
  "off-track": "danger",
};

const HEALTH_DOT: Record<ProjectHealth, string> = {
  "on-track": "bg-emerald-500",
  "at-risk": "bg-amber-500",
  "off-track": "bg-rose-500",
};

export const STATUS_DOT: Record<ProjectStatus, string> = {
  planning: "bg-slate-400 dark:bg-slate-500",
  "in-progress": "bg-blue-500",
  review: "bg-violet-500",
  launched: "bg-emerald-500",
};

export function HealthBadge({ health, className }: { health: ProjectHealth; className?: string }) {
  return (
    <Badge variant={HEALTH_VARIANT[health]} className={className}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", HEALTH_DOT[health])} />
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
