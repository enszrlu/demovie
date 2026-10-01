import type { ProjectHealth, ProjectStatus } from "./types";

export const STATUS_ORDER: readonly ProjectStatus[] = ["planning", "in-progress", "review", "launched"];

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning",
  "in-progress": "In progress",
  review: "Review",
  launched: "Launched",
};

export const HEALTH_LABEL: Record<ProjectHealth, string> = {
  "on-track": "On track",
  "at-risk": "At risk",
  "off-track": "Off track",
};
