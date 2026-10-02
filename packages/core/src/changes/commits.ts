import type { Changes } from "../schemas/reports.ts";

export type ChangeCommit = Changes["commits"][number];

/** Commit types that never reach users (SPEC §15.1: "ignoring chores, refactors, tests and docs"). */
const INTERNAL_TYPES = new Set(["chore", "refactor", "test", "tests", "docs", "doc", "ci", "build", "style", "deps"]);
const CONVENTIONAL = /^(?<type>[a-z]+)(?:\((?<scope>[^)]*)\))?(?<bang>!)?:\s*(?<subject>.+)$/i;
const MERGE_PR = /^Merge pull request #(\d+) from \S+/i;

/** Parse one commit: conventional-commit type/scope/subject, PR numbers from `(#123)` and merge messages. */
export function parseCommit(sha: string, subjectLine: string, body: string): ChangeCommit {
  let subject = subjectLine.trim();
  const prs = new Set<number>();
  const merge = subject.match(MERGE_PR);
  if (merge) {
    prs.add(Number(merge[1]));
    // GitHub puts the PR title on the first body line of merge commits
    const title = body
      .split("\n")
      .find((l) => l.trim())
      ?.trim();
    if (title) subject = title;
  }
  for (const m of subject.matchAll(/\(#(\d+)\)/g)) prs.add(Number(m[1]));
  const cc = subject.match(CONVENTIONAL);
  const type = cc?.groups?.type?.toLowerCase() ?? null;
  const scope = cc?.groups?.scope?.trim() || null;
  const clean = (cc?.groups?.subject ?? subject).replace(/\s*\(#\d+\)\s*/g, " ").trim();
  const breaking = Boolean(cc?.groups?.bang) || /^BREAKING[ -]CHANGE:/m.test(body);
  const internalWord = /^(chore|refactor|test|tests|docs|ci|build|style|bump|release|wip)\b/i.test(clean);
  const userVisible = type
    ? !INTERNAL_TYPES.has(type)
    : !internalWord && !/^Merge (branch|remote-tracking)/i.test(subject);
  return { sha, type, scope, subject: clean, breaking, prs: [...prs], userVisible };
}

/** "3 user-visible changes: …" from the commits users can see. */
export function storyLine(commits: ChangeCommit[]): string {
  const visible = commits.filter((c) => c.userVisible);
  if (visible.length === 0) return "No user-visible changes (only chores, refactors, tests or docs).";
  const shown = visible.slice(0, 3).map((c) => c.subject.replace(/\.$/, ""));
  const more = visible.length > 3 ? `; and ${visible.length - 3} more` : "";
  return `${visible.length} user-visible change${visible.length === 1 ? "" : "s"}: ${shown.join("; ")}${more}.`;
}
