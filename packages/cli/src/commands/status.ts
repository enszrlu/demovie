import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { checkUrl, findProjectRoot, loadProject, QaFileSchema, VERSION, VideoSchema } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import { installedSkillVersion, SKILL_DIRS } from "../lib/skill.ts";
import type { CommandResult } from "../output.ts";

interface VideoStatus {
  slug: string;
  type: string;
  status: string;
  duration: number;
  formats: string[];
  qa: { errors: number; warnings: number } | null;
  outputs: string[];
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

export async function run(ctx: CommandContext): Promise<CommandResult> {
  const root = findProjectRoot(ctx.cwd);
  if (!root) {
    return {
      data: { initialized: false, version: VERSION, next: "npx demovie init" },
      human: ["demovie is not initialized here.", "Next: npx demovie init"],
    };
  }
  const project = await loadProject(root);
  const { paths, resolved } = project;
  const reach = await checkUrl(resolved.app.url, { headers: resolved.app.headers, timeoutMs: 3000 });

  // Captures and freshness
  let captures: { total: number; stale: number; capturedAt: string | null; staleIds: string[] } = {
    total: 0,
    stale: 0,
    capturedAt: null,
    staleIds: [],
  };
  if (existsSync(paths.captureIndex)) {
    const { captureFreshness } = await import("@demovie/capture");
    const fresh = await captureFreshness(project);
    captures = {
      total: fresh.total,
      stale: fresh.stale.length,
      capturedAt: fresh.updatedAt,
      staleIds: fresh.stale.map((s) => s.id).slice(0, 20),
    };
  }

  // Videos
  const videos: VideoStatus[] = [];
  if (existsSync(paths.videosDir)) {
    for (const slug of readdirSync(paths.videosDir).sort()) {
      const file = path.join(paths.videosDir, slug, "video.json");
      if (!existsSync(file)) continue;
      const parsed = VideoSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
      if (!parsed.success) continue;
      const v = parsed.data;
      const qaFile = path.join(paths.videosDir, slug, "qa.json");
      const qa = existsSync(qaFile) ? QaFileSchema.safeParse(JSON.parse(readFileSync(qaFile, "utf8"))) : null;
      const outDir = path.join(paths.videosDir, slug, "out");
      videos.push({
        slug,
        type: v.type,
        status: v.status,
        duration: v.duration,
        formats: v.formats,
        qa: qa?.success ? { errors: qa.data.summary.errors, warnings: qa.data.summary.warnings } : null,
        outputs: existsSync(outDir) ? readdirSync(outDir).filter((f) => f.endsWith(".mp4")) : [],
      });
    }
  }

  // Installed skill freshness
  const skill = Object.entries(SKILL_DIRS).flatMap(([agent, rel]) => {
    const version = installedSkillVersion(path.join(root, rel));
    return version ? [{ agent, dir: rel, version, outdated: compareVersions(version, VERSION) < 0 }] : [];
  });
  const warnings: string[] = [];
  for (const s of skill)
    if (s.outdated)
      warnings.push(
        `the skill in ${s.dir} is ${s.version}, older than demovie ${VERSION}: run \`npx demovie skill install\``,
      );
  if (project.missingEnv.length) warnings.push(`unset env vars referenced by config: ${project.missingEnv.join(", ")}`);
  if (captures.stale > 0)
    warnings.push(`${captures.stale} capture(s) are stale: run \`npx demovie capture --changed\``);

  let next: string;
  if (!reach.ok && !resolved.app.start)
    next = `start your app at ${resolved.app.url} (or set app.start.command), then run \`npx demovie capture\``;
  else if (captures.total === 0) next = "npx demovie capture";
  else if (captures.stale > 0) next = "npx demovie capture --changed";
  else if (videos.length === 0)
    next = 'ask your agent: "/demovie make a 30s launch video" (or `npx demovie new launch --type launch`)';
  else {
    const pending = videos.find((v) => v.status !== "rendered");
    next = pending
      ? pending.status === "qa-pass"
        ? `npx demovie render ${pending.slug} --quality final --format all`
        : `continue ${pending.slug} (status: ${pending.status}); run \`npx demovie qa ${pending.slug}\` when animated`
      : "all videos rendered — share them, or make the next one";
  }

  const human = [
    `demovie ${VERSION} · ${resolved.project.name} (${resolved.project.framework})`,
    `app: ${resolved.app.url} ${reach.ok ? "✓ reachable" : `✗ not reachable${resolved.app.start ? " (demovie up starts it)" : ""}`}`,
    `auth: ${resolved.auth.strategy}${resolved.auth.loginPath ? ` (${resolved.auth.loginPath})` : ""}`,
    `captures: ${captures.total}${captures.total ? ` (${captures.stale} stale, updated ${captures.capturedAt})` : ""}`,
    `videos: ${videos.length ? videos.map((v) => `${v.slug} [${v.status}${v.qa ? `, QA ${v.qa.errors}E/${v.qa.warnings}W` : ""}]`).join(", ") : "none"}`,
    ...warnings.map((w) => `warn: ${w}`),
    `Next: ${next}`,
  ];
  return {
    data: {
      initialized: true,
      version: VERSION,
      root,
      project: { name: resolved.project.name, framework: resolved.project.framework },
      app: { url: resolved.app.url, reachable: reach.ok, status: reach.status, canStart: Boolean(resolved.app.start) },
      auth: { strategy: resolved.auth.strategy, loginPath: resolved.auth.loginPath },
      captures,
      videos,
      skill,
      warnings,
      next,
    },
    human,
  };
}
