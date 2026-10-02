/** verify checks 9–11 (SPEC §18): MCP smoke test, skill lint, plugin + marketplace manifests. */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  MarketplaceSchema,
  McpJsonSchema,
  PluginManifestSchema,
  parseFrontmatter,
  SkillFrontmatterSchema,
  which,
} from "../../packages/core/src/index.ts";
import { repoRoot } from "./repo.ts";
import { renderRuntimeApi, runtimeApiEntries } from "./runtime-api.ts";

export const SKILL_DIR = path.join(repoRoot, "packages/skill/demovie");
const SKILL_DESCRIPTION =
  "Make accurate, on-brand motion-graphics videos of the user's real web app (launch, feature, changelog, teaser, walkthrough, landing-page hero loop) with the demovie CLI. Use when the user asks for a product, launch, demo, promo, explainer or changelog video, motion graphics about their app, or a video per release.";
const REQUIRED_REFERENCES = [
  "runtime-api.md",
  "motion-principles.md",
  "pacing-and-formats.md",
  "brief-template.md",
  "storyboard-template.md",
  "flows.md",
  "audio.md",
  "troubleshooting.md",
  "styles/clean.md",
  "styles/bold.md",
  "styles/soft.md",
  "styles/editorial.md",
  "styles/terminal.md",
];

const cliVersion = () =>
  (JSON.parse(readFileSync(path.join(repoRoot, "packages/cli/package.json"), "utf8")) as { version: string }).version;

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full));
    else out.push(full);
  }
  return out.sort();
}

/** Relative markdown links (`](path)`) in a file that don't resolve. */
function brokenLinks(file: string): string[] {
  const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  const out: string[] = [];
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1]!.split("#")[0]!;
    if (!target || /^[a-z]+:/i.test(target)) continue;
    if (!existsSync(path.resolve(path.dirname(file), target))) out.push(`${path.relative(repoRoot, file)} → ${target}`);
  }
  return out;
}

/** Check 10: frontmatter, ≤ 400 lines, references exist and resolve, runtime-api.md matches the runtime's exports. */
export function lintSkill(dir = SKILL_DIR): { ok: boolean; detail: string } {
  const problems: string[] = [];
  const skillFile = path.join(dir, "SKILL.md");
  const text = readFileSync(skillFile, "utf8");
  const { data, body } = parseFrontmatter(text);
  const fm = SkillFrontmatterSchema.safeParse(data);
  if (!fm.success)
    problems.push(`frontmatter: ${fm.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  else {
    if (fm.data.name !== path.basename(dir)) problems.push(`name "${fm.data.name}" ≠ folder "${path.basename(dir)}"`);
    if (fm.data.description !== SKILL_DESCRIPTION) problems.push("description differs from SPEC §14.1");
    if (fm.data.metadata?.version !== cliVersion())
      problems.push(`metadata.version ${fm.data.metadata?.version} ≠ CLI ${cliVersion()} (run pnpm skill:build)`);
  }
  const lines = text.split("\n").length;
  if (lines > 400) problems.push(`SKILL.md has ${lines} lines (max 400)`);
  for (const section of ["Preflight", "Hard rules", "AI look", "Rubric", "out/share.md", "qa <slug> --format all"])
    if (!body.includes(section)) problems.push(`SKILL.md lacks "${section}"`);
  for (const ref of REQUIRED_REFERENCES)
    if (!existsSync(path.join(dir, "references", ref))) problems.push(`missing references/${ref}`);
  const examples = path.join(dir, "references/examples");
  if (!existsSync(examples) || readdirSync(examples).filter((f) => f.endsWith(".md")).length === 0)
    problems.push("references/examples/ is empty");
  for (const f of filesUnder(dir).filter((x) => x.endsWith(".md"))) problems.push(...brokenLinks(f));
  // runtime-api.md: generated from the runtime's exports and current
  const api = readFileSync(path.join(dir, "references/runtime-api.md"), "utf8");
  const entries = runtimeApiEntries();
  for (const e of entries) if (!api.includes(`### \`${e.name}\``)) problems.push(`runtime-api.md lacks ${e.name}`);
  const documented = [...api.matchAll(/^### `([^`]+)`/gm)].map((m) => m[1]!);
  for (const name of documented)
    if (!entries.some((e) => e.name === name)) problems.push(`runtime-api.md documents ${name}, which isn't exported`);
  if (api !== renderRuntimeApi(entries)) problems.push("runtime-api.md is stale (run pnpm skill:build)");
  return problems.length
    ? { ok: false, detail: problems.slice(0, 6).join("; ") }
    : {
        ok: true,
        detail: `SKILL.md ${lines} lines (≤ 400), frontmatter valid (v${cliVersion()}), ${REQUIRED_REFERENCES.length} references + ${readdirSync(examples).length} examples, all links resolve, runtime-api.md documents all ${entries.length} runtime exports`,
      };
}

function sameTree(a: string, b: string): boolean {
  const rel = (dir: string) => filesUnder(dir).map((f) => path.relative(dir, f));
  const fa = rel(a);
  const fb = existsSync(b) ? rel(b) : [];
  if (fa.join("\n") !== fb.join("\n")) return false;
  return fa.every((f) => readFileSync(path.join(a, f)).equals(readFileSync(path.join(b, f))));
}

/** Check 11: marketplace → plugin manifest, .mcp.json and skill copy; `npx skills add` discovery; claude validate. */
export function checkPluginManifests(): { ok: boolean; detail: string } {
  const problems: string[] = [];
  const marketplaceFile = path.join(repoRoot, ".claude-plugin/marketplace.json");
  const marketplace = MarketplaceSchema.safeParse(JSON.parse(readFileSync(marketplaceFile, "utf8")));
  if (!marketplace.success) return { ok: false, detail: `marketplace.json: ${marketplace.error.issues[0]?.message}` };
  const discovered: string[] = [];
  for (const entry of marketplace.data.plugins) {
    const root = path.join(repoRoot, entry.source);
    if (!existsSync(root) || !statSync(root).isDirectory()) {
      problems.push(`plugin source ${entry.source} missing`);
      continue;
    }
    const manifest = PluginManifestSchema.safeParse(
      JSON.parse(readFileSync(path.join(root, ".claude-plugin/plugin.json"), "utf8")),
    );
    if (!manifest.success)
      problems.push(`${entry.source}/.claude-plugin/plugin.json: ${manifest.error.issues[0]?.message}`);
    else {
      if (manifest.data.name !== entry.name)
        problems.push(`plugin name ${manifest.data.name} ≠ marketplace ${entry.name}`);
      if (manifest.data.version !== cliVersion())
        problems.push(`plugin version ${manifest.data.version} ≠ ${cliVersion()}`);
    }
    const mcp = McpJsonSchema.safeParse(JSON.parse(readFileSync(path.join(root, ".mcp.json"), "utf8")));
    const server = mcp.success ? mcp.data.mcpServers.demovie : undefined;
    const registered = server ? [server.command, ...server.args].join(" ") : "";
    if (registered !== "npx -y demovie mcp")
      problems.push(`${entry.source}/.mcp.json must register \`npx -y demovie mcp\``);
    // the skills CLI (`npx skills add owner/repo`) follows local marketplace sources to <source>/skills/<name>/SKILL.md
    for (const name of existsSync(path.join(root, "skills")) ? readdirSync(path.join(root, "skills")) : []) {
      const skill = path.join(root, "skills", name, "SKILL.md");
      if (!existsSync(skill)) continue;
      const fm = SkillFrontmatterSchema.safeParse(parseFrontmatter(readFileSync(skill, "utf8")).data);
      if (fm.success && fm.data.name === name) discovered.push(`${entry.source}/skills/${name}`);
    }
    if (!sameTree(SKILL_DIR, path.join(root, "skills/demovie")))
      problems.push(`${entry.source}/skills/demovie differs from packages/skill/demovie (run pnpm skill:build)`);
  }
  if (!discovered.length) problems.push("no skill discoverable through the marketplace (npx skills add)");
  let validator = "claude CLI not installed: schema validation only";
  if (which("claude")) {
    for (const target of [".", "plugins/demovie"]) {
      const r = spawnSync("claude", ["plugin", "validate", "--strict", target], { cwd: repoRoot, encoding: "utf8" });
      if (r.status !== 0)
        problems.push(`claude plugin validate --strict ${target}: ${(r.stdout + r.stderr).trim().split("\n").pop()}`);
    }
    validator = "`claude plugin validate --strict` passes for both";
  }
  return problems.length
    ? { ok: false, detail: problems.slice(0, 6).join("; ") }
    : {
        ok: true,
        detail: `marketplace → ${marketplace.data.plugins.map((p) => p.source).join(", ")}: plugin.json v${cliVersion()}, .mcp.json → npx -y demovie mcp, skill copy in sync; npx skills add discovers ${discovered.join(", ")}; ${validator}`,
      };
}
