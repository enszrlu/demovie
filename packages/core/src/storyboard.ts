import { readFile } from "node:fs/promises";
import { DemovieError } from "./errors.ts";
import { type Storyboard, StoryboardSchema } from "./schemas/video.ts";
import { parseFrontmatter } from "./util/frontmatter.ts";
import { formatIssues } from "./util/fs.ts";
import { parseMarkdownTable } from "./util/markdown.ts";

const COLUMNS: Record<string, keyof RowDraft> = {
  "#": "index",
  start: "start",
  dur: "dur",
  duration: "dur",
  kind: "kind",
  visual: "visual",
  "on-screen text": "text",
  "vo line": "vo",
  vo: "vo",
  "captures / element ids": "captures",
  captures: "captures",
  transition: "transition",
  notes: "notes",
};

interface RowDraft {
  index: string;
  start: string;
  dur: string;
  kind: string;
  visual: string;
  text: string;
  vo: string;
  captures: string;
  transition: string;
  notes: string;
}

const seconds = (cell: string): number => Number.parseFloat(cell.replace(/s$/i, "").trim());

/** Parse storyboard.md: frontmatter `bpm`, then the shot table (SPEC §6.6). Empty cells stay empty strings. */
export function parseStoryboard(markdown: string, source = "storyboard.md"): Storyboard {
  const { data, body } = parseFrontmatter(markdown);
  const table = parseMarkdownTable(body);
  const rows = (table?.rows ?? [])
    .map((cells) => {
      const draft: Partial<RowDraft> = {};
      table!.headers.forEach((header, i) => {
        const key = COLUMNS[header];
        if (key) draft[key] = cells[i] ?? "";
      });
      return draft;
    })
    .filter((d) => d.start !== undefined && d.start !== "" && !Number.isNaN(seconds(d.start)))
    .map((d, i) => ({
      index: Number.parseInt(d.index ?? "", 10) || i + 1,
      start: seconds(d.start!),
      dur: seconds(d.dur ?? ""),
      kind: (d.kind ?? "other").toLowerCase() || "other",
      visual: d.visual ?? "",
      text: d.text ?? "",
      vo: d.vo ?? "",
      captures: (d.captures ?? "")
        .split(/[;,]\s*/)
        .map((c) => c.trim())
        .filter(Boolean),
      transition: d.transition ?? "",
      notes: d.notes ?? "",
    }));
  const parsed = StoryboardSchema.safeParse({ bpm: data.bpm ?? null, rows });
  if (!parsed.success) {
    throw new DemovieError(
      "E_CONFIG",
      `${source} is not a valid storyboard: ${formatIssues(parsed.error)}`,
      `fix the shot table in ${source}: numeric start/dur, kind one of product|title|text|logo|other`,
    );
  }
  return parsed.data;
}

export async function readStoryboard(file: string): Promise<Storyboard> {
  return parseStoryboard(await readFile(file, "utf8"), file);
}
