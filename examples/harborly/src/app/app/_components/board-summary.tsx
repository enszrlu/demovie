import { HEALTH_LABEL } from "@/lib/labels";
import { isActive } from "@/lib/metrics";
import type { Db, ProjectHealth } from "@/lib/types";
import { cn } from "@/lib/utils";

const HEALTHS: { health: ProjectHealth; dot: string }[] = [
  { health: "on-track", dot: "bg-emerald-500" },
  { health: "at-risk", dot: "bg-amber-500" },
  { health: "off-track", dot: "bg-rose-500" },
];

/** One line above the board: totals on the left, a health legend with counts on the right. */
export function BoardSummary({ db }: { db: Db }) {
  const total = db.projects.length;
  const active = db.projects.filter(isActive);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <p className="text-sm text-muted-foreground">
        {total > 0 ? (
          <>
            <span className="font-medium text-foreground">{total} projects</span> · {active.length} active in{" "}
            {db.workspace.name}
          </>
        ) : (
          <>No projects in {db.workspace.name} yet</>
        )}
      </p>
      {total > 0 ? (
        <ul aria-label="Active projects by health" className="flex items-center gap-4 text-xs text-muted-foreground">
          {HEALTHS.map(({ health, dot }) => (
            <li key={health} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn("size-2 rounded-full", dot)} />
              {HEALTH_LABEL[health]}
              <span className="font-medium tabular-nums text-foreground">
                {active.filter((project) => project.health === health).length}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
