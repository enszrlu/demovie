import { addDays, parseDate, toDateOnly } from "./format";
import type { ChecklistItem, Db, Milestone, Project } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_CHECKLIST = [
  "Define launch goals",
  "Lock scope and owners",
  "QA sign-off",
  "Prepare launch assets",
  "Go / no-go review",
] as const;

export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug || "project";
}

/** `prj_<slug>`, with `-2`, `-3`, … appended while the id is taken. */
export function uniqueProjectId(db: Db, name: string): string {
  const base = `prj_${slugify(name)}`;
  const taken = new Set(db.projects.map((project) => project.id));
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function nextActivityId(db: Db): string {
  const highest = db.activity.reduce((max, item) => {
    const value = Number.parseInt(item.id.replace(/^act_/, ""), 10);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return `act_${String(highest + 1).padStart(3, "0")}`;
}

/** Kickoff → Scope locked → Beta → Launch, spaced across the time until the launch date (8 weeks without one). */
function defaultMilestones(startDate: string, dueDate: string | null): Milestone[] {
  const span = dueDate
    ? Math.max(4, Math.round((parseDate(dueDate).getTime() - parseDate(startDate).getTime()) / DAY_MS))
    : 56;
  const at = (fraction: number) => addDays(startDate, Math.round(span * fraction));
  return [
    { id: "mls_1", label: "Kickoff", date: startDate, done: false },
    { id: "mls_2", label: "Scope locked", date: at(0.25), done: false },
    { id: "mls_3", label: "Beta", date: at(0.6), done: false },
    { id: "mls_4", label: "Launch", date: dueDate ?? at(1), done: false },
  ];
}

export function buildNewProject(input: {
  db: Db;
  name: string;
  customerId: string | null;
  ownerId: string;
  launchDate: string | null;
  now: Date;
}): Project {
  const today = toDateOnly(input.now);
  // A launch date in the past still gets a sensible plan: start four weeks before it.
  const startDate = input.launchDate && input.launchDate < today ? addDays(input.launchDate, -28) : today;
  const checklist: ChecklistItem[] = DEFAULT_CHECKLIST.map((label, index) => ({
    id: `chk_${index + 1}`,
    label,
    done: false,
    assigneeId: input.ownerId,
  }));
  return {
    id: uniqueProjectId(input.db, input.name),
    name: input.name,
    summary: "A new launch plan. Add scope, owners and dates as the plan takes shape.",
    status: "planning",
    health: "on-track",
    progress: 0,
    customerId: input.customerId,
    ownerId: input.ownerId,
    startDate,
    dueDate: input.launchDate,
    launchedAt: null,
    createdAt: input.now.toISOString(),
    checklist,
    milestones: defaultMilestones(startDate, input.launchDate),
    progressHistory: [{ date: startDate, progress: 0 }],
  };
}
