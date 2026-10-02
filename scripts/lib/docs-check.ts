/** verify check 13 (SPEC §18): internal links in the docs resolve, and every CLI command they mention exists. */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { generatedDocs } from "./docs-gen.ts";
import { repoRoot } from "./repo.ts";

/** Command groups whose subcommands are listed by `demovie <group> --help`. */
const GROUPS = ["auth", "flow", "glossary", "audio", "skill", "ci"];

/** Commands listed by `demovie --help`, plus `<group> <sub>` for command groups. */
export function helpCommands(cli: string): Set<string> {
  const help = (args: string[]) =>
    spawnSync(process.execPath, [cli, ...args, "--help"], { encoding: "utf8" }).stdout ?? "";
  const names = (text: string) =>
    (text.split(/\nCommands:\n/)[1] ?? "")
      .split("\n")
      .map((l) => l.match(/^ {2}([a-z][a-z-]*)/)?.[1])
      .filter((n): n is string => Boolean(n) && n !== "help");
  const out = new Set<string>();
  for (const top of names(help([]))) {
    out.add(top);
    if (GROUPS.includes(top)) for (const sub of names(help([top]))) out.add(`${top} ${sub}`);
  }
  return out;
}

/** README.md, CONTRIBUTING.md and every docs/*.md. */
export function markdownFiles(): string[] {
  const docs = path.join(repoRoot, "docs");
  const files = existsSync(docs)
    ? readdirSync(docs)
        .filter((f) => f.endsWith(".md"))
        .sort()
        .map((f) => path.join(docs, f))
    : [];
  for (const f of ["README.md", "CONTRIBUTING.md"])
    if (existsSync(path.join(repoRoot, f))) files.push(path.join(repoRoot, f));
  return files;
}

const FENCE = /```[\s\S]*?```/g;

/** Relative link targets (outside code) that don't exist on disk. */
export function brokenLinks(file: string): string[] {
  const text = readFileSync(file, "utf8").replace(FENCE, "");
  const out: string[] = [];
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = decodeURIComponent(m[1]!.split("#")[0]!);
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    if (!existsSync(path.resolve(path.dirname(file), target))) out.push(`${path.relative(repoRoot, file)} → ${m[1]}`);
  }
  return out;
}

/**
 * `demovie <command> [<sub>]` invocations inside code: a fenced line or an inline code span that starts with
 * `demovie` (after an optional `$ ` prompt), or `npx demovie` / `npx -y demovie` / `bunx demovie` anywhere in code.
 * Prose inside code ("on the demovie runtime", log messages) isn't an invocation.
 */
export function mentionedCommands(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const fencedLines = (text.match(FENCE) ?? []).flatMap((block) => block.split("\n"));
  const inline = (text.replace(FENCE, "").match(/`[^`\n]+`/g) ?? []).map((span) => span.slice(1, -1));
  const out = new Set<string>();
  const add = (cmd: string | undefined, sub: string | undefined) => {
    if (cmd) out.add(GROUPS.includes(cmd) && sub ? `${cmd} ${sub}` : cmd);
  };
  for (const code of [...fencedLines, ...inline]) {
    const head = code.match(/^\s*(?:\$\s+)?demovie ([a-z][a-z-]*)(?: ([a-z][a-z-]*))?/);
    if (head) add(head[1], head[2]);
    for (const m of code.matchAll(/\b(?:npx (?:-y )?|bunx )demovie ([a-z][a-z-]*)(?: ([a-z][a-z-]*))?/g))
      add(m[1], m[2]);
  }
  return [...out];
}

export function checkDocs(cli: string): { ok: boolean; detail: string } {
  const files = markdownFiles();
  const commands = helpCommands(cli);
  const problems: string[] = [];
  let links = 0;
  const mentioned = new Set<string>();
  for (const f of files) {
    links += (readFileSync(f, "utf8").replace(FENCE, "").match(/\]\(/g) ?? []).length;
    problems.push(...brokenLinks(f).map((l) => `broken link ${l}`));
    for (const c of mentionedCommands(f)) {
      mentioned.add(c);
      if (!commands.has(c))
        problems.push(`${path.relative(repoRoot, f)} mentions \`demovie ${c}\`, which isn't in --help`);
    }
  }
  if (!commands.size) problems.push("could not read the command list from `demovie --help`");
  const stale = generatedDocs()
    .filter(
      ([rel, content]) =>
        !existsSync(path.join(repoRoot, rel)) || readFileSync(path.join(repoRoot, rel), "utf8") !== content,
    )
    .map(([rel]) => rel);
  if (stale.length) problems.push(`${stale.join(", ")} out of date: run \`pnpm docs:build\``);
  return problems.length
    ? { ok: false, detail: problems.slice(0, 8).join("; ") }
    : {
        ok: true,
        detail: `${files.length} docs, ${links} links resolve; ${mentioned.size} CLI commands mentioned, all in --help; generated docs (config, qa-rules, compositions) up to date`,
      };
}
