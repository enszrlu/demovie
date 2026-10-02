import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { routePatternToRegExp } from "../detect/routes.ts";
import { DemovieError } from "../errors.ts";
import type { Project } from "../project.ts";
import { RoutesSchema } from "../schemas/project-files.ts";
import type { Changes } from "../schemas/reports.ts";
import { readJson, toPosix } from "../util/fs.ts";
import { execCapture, which } from "../util/proc.ts";
import { parseCommit, storyLine } from "./commits.ts";
import { buildImportGraph, reachTargets } from "./import-graph.ts";
import { layoutChain } from "./layouts.ts";

export * from "./commits.ts";
export * from "./import-graph.ts";
export * from "./layouts.ts";
export * from "./resolve.ts";

async function git(cwd: string, args: string[]): Promise<string> {
  const r = await execCapture("git", args, { cwd });
  if (r.code !== 0)
    throw new DemovieError(
      "E_GIT",
      `git ${args.join(" ")} failed: ${r.stderr.trim().split("\n").pop()}`,
      "run demovie inside a git repository with at least one commit, and pass an existing ref to --since",
    );
  return r.stdout;
}

const tryGit = async (cwd: string, args: string[]) => {
  const r = await execCapture("git", args, { cwd });
  return r.code === 0 ? r.stdout.trim() : null;
};

/** Default range: the latest tag reachable from HEAD, else the last 20 commits (SPEC §15.1). */
export async function defaultSince(cwd: string): Promise<string | null> {
  const tag = await tryGit(cwd, ["describe", "--tags", "--abbrev=0"]);
  // Right after tagging a release HEAD *is* the tag: compare with the tag before it.
  const atTag = tag ? await tryGit(cwd, ["describe", "--tags", "--exact-match", "HEAD"]) : null;
  if (tag && atTag) return (await tryGit(cwd, ["describe", "--tags", "--abbrev=0", "HEAD^"])) ?? tag;
  if (tag) return tag;
  const count = Number((await tryGit(cwd, ["rev-list", "--count", "HEAD"])) ?? "0");
  return count > 20 ? "HEAD~20" : null;
}

interface FlowRef {
  name: string;
  paths: string[];
}

/** Flow names with the paths they visit (`start` and `goto` steps of YAML flows; `start` of TS flows). */
function flowPaths(flowsDir: string): FlowRef[] {
  if (!existsSync(flowsDir)) return [];
  const out: FlowRef[] = [];
  for (const file of readdirSync(flowsDir).sort()) {
    const full = path.join(flowsDir, file);
    if (/\.flow\.ya?ml$/.test(file)) {
      try {
        const flow = parseYaml(readFileSync(full, "utf8")) as { name?: string; start?: string; steps?: unknown[] };
        const gotos = (flow.steps ?? [])
          .map((s) => (s && typeof s === "object" && "goto" in s ? String((s as { goto: unknown }).goto) : null))
          .filter((x): x is string => Boolean(x));
        out.push({ name: flow.name ?? file.replace(/\.flow\.ya?ml$/, ""), paths: [flow.start ?? "/", ...gotos] });
      } catch {
        // invalid flows are reported by `capture`
      }
    } else if (/\.flow\.(ts|mts|js|mjs)$/.test(file)) {
      const start = readFileSync(full, "utf8").match(/start:\s*["'`]([^"'`]+)["'`]/)?.[1];
      out.push({ name: file.replace(/\.flow\.\w+$/, ""), paths: [start ?? "/"] });
    }
  }
  return out;
}

async function pullRequestDetails(
  cwd: string,
  numbers: number[],
): Promise<Map<number, { title: string; body: string }>> {
  const out = new Map<number, { title: string; body: string }>();
  if (!numbers.length || !which("gh")) return out;
  const auth = await execCapture("gh", ["auth", "status"], { cwd });
  if (auth.code !== 0) return out;
  for (const n of numbers.slice(0, 20)) {
    const r = await execCapture("gh", ["pr", "view", String(n), "--json", "title,body"], { cwd });
    if (r.code !== 0) continue;
    try {
      const pr = JSON.parse(r.stdout) as { title: string; body: string };
      out.set(n, { title: pr.title, body: (pr.body ?? "").slice(0, 2000) });
    } catch {
      // ignore unreadable PRs
    }
  }
  return out;
}

export interface AnalyzeChangesOptions {
  /** git ref; default: the latest tag, else the last 20 commits. */
  since?: string | null;
  /** Ask `gh` for PR titles and bodies when it is installed and authenticated (default true). */
  gh?: boolean;
  /** Also count uncommitted changes (`capture --changed` on a dirty tree); the changelog uses commits only. */
  workingTree?: boolean;
}

/**
 * `demovie changes` (SPEC §15.1): commits, changed files and the routes they affect — directly (page/layout files) or
 * through the reverse import graph (tsconfig paths resolved, up to 6 hops) — plus capture and story suggestions.
 */
export async function analyzeChanges(project: Project, o: AnalyzeChangesOptions = {}): Promise<Changes> {
  const root = project.paths.root;
  const top = (await git(root, ["rev-parse", "--show-toplevel"])).trim();
  const appRel = toPosix(path.relative(top, root));
  // git runs in the app folder: pathspecs are relative to it, while diff/status/--full-name paths are top-relative
  const scope = appRel ? ["--", "."] : [];
  const headSha = await tryGit(root, ["rev-parse", "--verify", "HEAD"]);
  if (!headSha)
    throw new DemovieError(
      "E_GIT",
      "this repository has no commits yet, so there are no changes to describe",
      "commit your app first, then run `npx demovie changes`",
    );
  const head = headSha.trim();
  const since = o.since === undefined || o.since === null ? await defaultSince(root) : o.since;
  const sinceSha = since ? (await git(root, ["rev-parse", "--verify", `${since}^{commit}`])).trim() : "";

  const log = await git(root, [
    "log",
    "--no-color",
    "--format=%H%x1f%s%x1f%b%x1e",
    since ? `${sinceSha}..HEAD` : "HEAD",
    ...scope,
  ]);
  const commits = log
    .split("\x1e")
    .map((r) => r.replace(/^\n/, ""))
    .filter((r) => r.trim())
    .map((r) => {
      const [sha, subject, body] = r.split("\x1f");
      return parseCommit(sha!.trim(), subject ?? "", body ?? "");
    });
  if (o.gh !== false) {
    const prs = await pullRequestDetails(root, [...new Set(commits.flatMap((c) => c.prs))]);
    for (const c of commits) {
      const pr = c.prs.map((n) => prs.get(n)).find(Boolean);
      if (pr) c.pr = pr;
    }
  }

  const diff = since
    ? await git(root, ["diff", "--no-color", "--name-status", `${sinceSha}...HEAD`, ...scope])
    : (await git(root, ["ls-files", "--full-name"]))
        .split("\n")
        .filter(Boolean)
        .map((f) => `A\t${f}`)
        .join("\n");
  const files = diff
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      const status = parts[0]!.charAt(0);
      const file = parts[parts.length - 1]!;
      return { path: toPosix(appRel ? path.relative(appRel, file) : file), status };
    })
    .filter((f) => !f.path.startsWith(".."));
  if (o.workingTree) {
    const status = await git(root, ["status", "--porcelain", "--untracked-files=all", ...scope]);
    for (const line of status.split("\n").filter(Boolean)) {
      const file = line.slice(3).split(" -> ").pop()!;
      const rel = toPosix(appRel ? path.relative(appRel, file) : file);
      if (rel.startsWith("..") || files.some((f) => f.path === rel)) continue;
      const code = line.slice(0, 2).trim();
      files.push({ path: rel, status: code === "??" ? "A" : code.charAt(0) });
    }
  }

  if (!existsSync(project.paths.routes))
    throw new DemovieError("E_NOT_FOUND", "no .demovie/routes.json", "run `npx demovie extract routes`");
  const { routes } = await readJson(project.paths.routes, RoutesSchema);
  const nextjs = project.config.project.nextjs;
  const routerRootFor = (file: string) =>
    nextjs?.appDir && file.startsWith(`${nextjs.appDir}/`) ? nextjs.appDir : (nextjs?.pagesDir ?? null);
  const chains = new Map<string, string[]>();
  for (const r of routes) if (r.file) chains.set(r.path, layoutChain(root, r.file, routerRootFor(r.file)));

  const changedPaths = files.filter((f) => f.status !== "D").map((f) => f.path);
  const changedSet = new Set(files.map((f) => f.path));
  const affected = new Map<string, Changes["routes"][number]>();
  for (const r of routes) {
    const hit = (chains.get(r.path) ?? []).find((f) => changedSet.has(f));
    if (hit) affected.set(r.path, { path: r.path, file: r.file ?? null, reason: "direct", via: [hit] });
  }
  const targets = new Set([...chains.values()].flat());
  const sourceChanges = changedPaths.filter((f) => /\.(tsx?|mts|cts|jsx?|mjs|cjs|css)$/.test(f));
  if (sourceChanges.length) {
    const reached = reachTargets(buildImportGraph(root), sourceChanges, targets, 6);
    for (const r of routes) {
      if (affected.has(r.path)) continue;
      const chain = (chains.get(r.path) ?? [])
        .map((f) => reached.get(f))
        .filter((c): c is string[] => Boolean(c))
        .sort((a, b) => a.length - b.length)[0];
      if (chain) affected.set(r.path, { path: r.path, file: r.file ?? null, reason: "import", via: chain });
    }
  }
  const affectedRoutes = [...affected.values()].sort((a, b) => a.path.localeCompare(b.path));
  const patterns = affectedRoutes.map((r) => routePatternToRegExp(r.path));
  const flows = flowPaths(project.paths.flowsDir)
    .filter((f) => f.paths.some((p) => patterns.some((re) => re.test(p.split("?")[0]!))))
    .map((f) => f.name);

  return {
    since: since ?? "(all history)",
    sinceSha,
    head,
    generatedAt: new Date().toISOString(),
    commits,
    files,
    routes: affectedRoutes,
    suggestions: { captures: affectedRoutes.map((r) => r.path), flows, story: storyLine(commits) },
  };
}
