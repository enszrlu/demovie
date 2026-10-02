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
