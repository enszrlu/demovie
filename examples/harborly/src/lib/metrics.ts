// Everything the dashboard, team and reports pages show is derived here from the db, never hard-coded.
import { parseDate, toDateOnly } from "./format";
import { STATUS_ORDER } from "./labels";
import type { Db, Person, Project, ProjectStatus } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The dataset's own "now" (seeded data is written for a fixed instant); real time otherwise. */
export function referenceNow(db: Db): Date {
  return db.meta.referenceNow ? new Date(db.meta.referenceNow) : new Date();
}

export function isActive(project: Project): boolean {
  return project.status !== "launched";
}

export function quarterOf(date: Date): { start: string; end: string; label: string } {
  const quarter = Math.floor(date.getUTCMonth() / 3);
  const year = date.getUTCFullYear();
  return {
    start: toDateOnly(new Date(Date.UTC(year, quarter * 3, 1))),
    end: toDateOnly(new Date(Date.UTC(year, quarter * 3 + 3, 0))),
    label: `Q${quarter + 1} ${year}`,
  };
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export interface DashboardKpis {
  activeProjects: number;
  startedLast30Days: number;
  onTrack: number;
  onTrackPercent: number | null;
  launchedThisQuarter: number;
  scheduledThisQuarter: number;
  quarterLabel: string;
  avgVelocity: number | null;
  velocityChangePercent: number | null;
}

export function dashboardKpis(db: Db): DashboardKpis {
  const now = referenceNow(db);
  const active = db.projects.filter(isActive);
  const onTrack = active.filter((project) => project.health === "on-track").length;
  const monthAgo = now.getTime() - 30 * DAY_MS;
  const quarter = quarterOf(now);
  const inQuarter = (day: string | null) => day !== null && day >= quarter.start && day <= quarter.end;

  const completed = db.velocity.map((week) => week.completed);
  const recent = average(completed.slice(-4));
  const previous = average(completed.slice(-8, -4));

  return {
    activeProjects: active.length,
    startedLast30Days: active.filter((project) => parseDate(project.createdAt).getTime() >= monthAgo).length,
    onTrack,
    onTrackPercent: active.length ? Math.round((onTrack / active.length) * 100) : null,
    launchedThisQuarter: db.projects.filter((project) => project.status === "launched" && inQuarter(project.launchedAt))
      .length,
    scheduledThisQuarter: active.filter((project) => inQuarter(project.dueDate)).length,
    quarterLabel: quarter.label,
    avgVelocity: recent,
    velocityChangePercent:
      recent !== null && previous !== null && previous > 0 ? Math.round(((recent - previous) / previous) * 100) : null,
  };
}

/** Board order: columns in workflow order, newest project first within a column. */
export function projectsByStatus(projects: Project[]): Record<ProjectStatus, Project[]> {
  const columns = Object.fromEntries(STATUS_ORDER.map((status) => [status, [] as Project[]])) as Record<
    ProjectStatus,
    Project[]
  >;
  for (const project of projects) columns[project.status].push(project);
  for (const status of STATUS_ORDER) columns[status].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return columns;
}

export function upcomingLaunches(db: Db, limit: number): Project[] {
  return db.projects
    .filter((project) => isActive(project) && project.dueDate !== null)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, limit);
}

export interface Workload {
  person: Person;
  activeProjects: number;
  openItems: number;
  /** 0–100 */
  load: number;
}

export function teamWorkload(db: Db): Workload[] {
  const active = db.projects.filter(isActive);
  return db.people.map((person) => {
    const involved = active.filter(
      (project) => project.ownerId === person.id || project.checklist.some((item) => item.assigneeId === person.id),
    );
    const owned = active.filter((project) => project.ownerId === person.id).length;
    const openItems = active.reduce(
      (count, project) =>
        count + project.checklist.filter((item) => item.assigneeId === person.id && !item.done).length,
      0,
    );
    return {
      person,
      activeProjects: involved.length,
      openItems,
      load: Math.min(100, owned * 15 + openItems * 8),
    };
  });
}

export interface LaunchedProjectRow {
  project: Project;
  durationDays: number;
  /** Positive when it shipped after its due date. */
  daysLate: number;
}

export function launchedProjects(db: Db): LaunchedProjectRow[] {
  return db.projects
    .filter((project) => project.status === "launched" && project.launchedAt)
    .sort((a, b) => (b.launchedAt ?? "").localeCompare(a.launchedAt ?? ""))
    .map((project) => {
      const launched = parseDate(project.launchedAt ?? project.startDate).getTime();
      const due = project.dueDate ? parseDate(project.dueDate).getTime() : launched;
      return {
        project,
        durationDays: Math.round((launched - parseDate(project.startDate).getTime()) / DAY_MS),
        daysLate: Math.max(0, Math.round((launched - due) / DAY_MS)),
      };
    });
}

export interface BurnupPoint {
  date: string;
  /** Actual progress; null for weeks that haven't happened yet. */
  completed: number | null;
  /** Straight-line plan from start to due date; null without a due date. */
  planned: number | null;
}

/** Weekly actual progress, extended to the due date with the plan line only. */
export function burnup(project: Project): BurnupPoint[] {
  const start = parseDate(project.startDate).getTime();
  const due = project.dueDate ? parseDate(project.dueDate).getTime() : null;
  const plannedAt = (time: number) =>
    due === null
      ? null
      : Math.max(0, Math.min(100, Math.round(((time - start) / Math.max(DAY_MS, due - start)) * 100)));

  const history = project.progressHistory.length
    ? project.progressHistory
    : [{ date: project.startDate, progress: project.progress }];
  const points: BurnupPoint[] = history.map((point) => ({
    date: point.date,
    completed: point.progress,
    planned: plannedAt(parseDate(point.date).getTime()),
  }));

  if (due !== null && project.dueDate) {
    let cursor = parseDate(points[points.length - 1]?.date ?? project.startDate).getTime();
    while (cursor + 7 * DAY_MS <= due) {
      cursor += 7 * DAY_MS;
      points.push({ date: toDateOnly(new Date(cursor)), completed: null, planned: plannedAt(cursor) });
    }
    if (cursor < due) points.push({ date: project.dueDate, completed: null, planned: 100 });
  }
  return points;
}
