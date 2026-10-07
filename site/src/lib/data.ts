/** Data the pages share, read from the repo at build time so the site never drifts from the docs. */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface QaRule {
  id: string;
  severity: "error" | "warn";
  title: string;
  measurement: string;
  fix: string;
  category: string;
}

export const QA_CATEGORIES: Record<string, string> = {
  T: "Text",
  L: "Layout",
  P: "Pacing",
  G: "Truth",
  A: "Assets",
  R: "Determinism",
  S: "Sound",
  V: "AI look",
};

const cell = (s: string) => s.trim().replace(/\\\|/g, "|");

/** The rule table of docs/qa-rules.md (generated from packages/qa/src/rules.ts). */
export function readQaRules(repoRoot: string): QaRule[] {
  const md = readFileSync(path.join(repoRoot, "docs/qa-rules.md"), "utf8");
  const rules: QaRule[] = [];
  for (const line of md.split("\n")) {
    const m = line.match(/^\| (DM-([A-Z])\d+) \|(.*)\|\s*$/);
    if (!m) continue;
    const cols = m[3]!.split(/(?<!\\)\|/).map(cell);
    const [severity, title, measurement, fix] = cols;
    rules.push({
      id: m[1]!,
      severity: severity === "warn" ? "warn" : "error",
      title: title ?? "",
      measurement: measurement ?? "",
      fix: fix ?? "",
      category: QA_CATEGORIES[m[2]!] ?? "Other",
    });
  }
  return rules;
}

export interface VideoInfo {
  slug: string;
  title: string;
  type: string;
  style: string;
  duration: number;
  formats: string[];
  fps: number;
}

export function readVideo(dir: string): VideoInfo {
  const v = JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8"));
  return {
    slug: v.slug,
    title: v.title,
    type: v.type,
    style: v.style,
    duration: v.duration,
    formats: v.formats,
    fps: v.fps,
  };
}

/** Frontmatter fields of a brief.md (simple `key: value` lines). */
export function readBrief(dir: string): Record<string, string> {
  const file = path.join(dir, "brief.md");
  if (!existsSync(file)) return {};
  const fm = readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const out: Record<string, string> = {};
  for (const line of fm.split("\n")) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) out[m[1]!] = m[2]!.replace(/^"(.*)"$/, "$1");
  }
  return out;
}

export interface Shot {
  start: number;
  kind: string;
  text: string;
}

/** The shot table of a storyboard.md: start time, kind and on-screen text. */
export function readStoryboard(dir: string): Shot[] {
  const file = path.join(dir, "storyboard.md");
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, "utf8").split("\n");
  const header = lines.find((l) => /^\|\s*#\s*\|/.test(l));
  if (!header) return [];
  const names = header
    .split("|")
    .slice(1, -1)
    .map((h) => h.trim().toLowerCase());
  const col = (name: string) => names.findIndex((n) => n.startsWith(name));
  const [iStart, iKind, iText] = [col("start"), col("kind"), col("on-screen")];
  return lines
    .filter((l) => /^\|\s*\d+\s*\|/.test(l))
    .map((l) => {
      const c = l.split("|").slice(1, -1).map(cell);
      return { start: Number(c[iStart]), kind: c[iKind] ?? "", text: c[iText] ?? "" };
    })
    .filter((s) => Number.isFinite(s.start));
}

export function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}
