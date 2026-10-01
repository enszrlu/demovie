export type ProjectStatus = "planning" | "in-progress" | "review" | "launched";
export type ProjectHealth = "on-track" | "at-risk" | "off-track";

export interface Workspace {
  id: string;
  name: string;
  plan: string;
}

export interface User {
  id: string;
  email: string;
  /** scrypt$<salt base64url>$<hash base64url> */
  passwordHash: string;
  personId: string;
  /** Shown on the settings page; deliberately not an @harborly.demo address so redaction can be tested. */
  profileEmail: string;
}

export type AvatarColor = "blue" | "violet" | "emerald" | "amber" | "rose" | "cyan" | "indigo" | "orange";

export interface Person {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarColor?: AvatarColor;
}

export interface Company {
  id: string;
  name: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  assigneeId: string | null;
}

export interface Milestone {
  id: string;
  label: string;
  /** YYYY-MM-DD */
  date: string;
  done: boolean;
}

export interface ProgressPoint {
  /** YYYY-MM-DD */
  date: string;
  progress: number;
}

export interface Project {
  id: string;
  name: string;
  summary: string;
  status: ProjectStatus;
  health: ProjectHealth;
  /** 0–100 */
  progress: number;
  customerId: string | null;
  ownerId: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  dueDate: string | null;
  /** YYYY-MM-DD */
  launchedAt: string | null;
  /** ISO timestamp */
  createdAt: string;
  checklist: ChecklistItem[];
  milestones: Milestone[];
  progressHistory: ProgressPoint[];
}

export type ActivityType =
  | "completed_item"
  | "created_project"
  | "moved_project"
  | "commented"
  | "health_changed"
  | "milestone_reached"
  | "launched_project";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  actorId: string;
  projectId: string;
  /** Checklist label, milestone label, status or health label, depending on `type`. */
  detail: string | null;
  /** ISO timestamp */
  at: string;
}

export interface VelocityPoint {
  /** Monday of the week, YYYY-MM-DD */
  weekStart: string;
  completed: number;
  committed: number;
}

export interface CycleTimeStage {
  stage: string;
  days: number;
}

export interface DbMeta {
  source: "default" | "seed";
  /** The "now" the dataset was written for; server-side metrics are computed relative to it. */
  referenceNow: string | null;
}

export interface Db {
  version: 1;
  meta: DbMeta;
  workspace: Workspace;
  users: User[];
  people: Person[];
  companies: Company[];
  projects: Project[];
  activity: ActivityItem[];
  velocity: VelocityPoint[];
  cycleTimes: CycleTimeStage[];
}
