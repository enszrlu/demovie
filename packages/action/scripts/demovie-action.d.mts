export interface ActionVideo {
  slug?: string;
  title: string;
  type: string;
  duration: number;
  outDir?: string;
  mp4s: string[];
  posters: string[];
  qa: { errors: number; warnings: number; waived: number } | null;
}

export interface ActionSummary {
  since: string | null;
  story?: string;
  run?: string | null;
  videos: ActionVideo[];
}

export function defaultSince(): string | null;
export function commentMarkdown(summary: ActionSummary, assetBase?: string | null): string;

export interface DetectedPackageManager {
  manager: "pnpm" | "npm-ci" | "yarn" | "yarn-berry" | "bun" | "npm";
  dir: string;
  lockfile: string;
  packageJson: string;
  pnpmVersion: string;
}

export function detectPackageManager(from: string, top?: string): DetectedPackageManager;
