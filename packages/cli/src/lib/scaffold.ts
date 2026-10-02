import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  assetDir,
  type CaptureIndex,
  CaptureIndexSchema,
  DemovieError,
  type ElementMap,
  FormatId,
  GlossarySchema,
  type Project,
  type StyleId,
  schemaRef,
  TYPE_PRESETS,
  VideoSchema,
  type VideoType,
  writeFileAtomic,
  writeJson,
} from "@demovie/core";

/** Motion tokens per style preset (SPEC §10.5); mirrored in skill/references/styles/<style>.md. */
export const STYLE_MOTION: Record<StyleId, { ease: string; duration: number }> = {
  clean: { ease: "expo.out", duration: 0.8 },
  bold: { ease: "power4.out", duration: 0.5 },
  soft: { ease: "back.out(1.4)", duration: 0.9 },
  editorial: { ease: "power2.out", duration: 1.2 },
  terminal: { ease: "power3.out", duration: 0.6 },
};

export interface ScaffoldOptions {
  slug: string;
  type: VideoType;
  duration?: number | undefined;
  formats?: FormatId[] | undefined;
  style?: StyleId | undefined;
  about?: string | undefined;
  force?: boolean | undefined;
}

const fill = (template: string, values: Record<string, string>): string =>
  template.replace(/\{\{([A-Z_]+)\}\}/g, (m, key: string) => (key in values ? values[key]! : m));

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const yamlString = (s: string | null): string => (s ? JSON.stringify(s) : "null");

/** Words of `--about` worth matching against a page: three letters or more, plural "s" dropped. */
const aboutWords = (about: string | undefined): string[] =>
  (about?.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])
    .filter((w) => !["the", "and", "for", "with", "new", "your", "our", "now"].includes(w))
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));

/**
 * Pick a desktop route capture to start from: pages whose path or headings match `--about` first, then logged-in,
 * non-dynamic pages with tagged elements, shallow paths first; then a focus target that is a meaningful region
 * (5–45% of the viewport), not a whole page or a tiny control.
 */
function pickCapture(project: Project, about?: string): { id: string; focus: string } | null {
  const index: CaptureIndex = existsSync(project.paths.captureIndex)
    ? CaptureIndexSchema.parse(JSON.parse(readFileSync(project.paths.captureIndex, "utf8")))
    : scanCaptures(project);
  const viewport = project.resolved.capture.defaultViewports[0];
  const load = (id: string): ElementMap | null => {
    const file = path.join(project.paths.capturesDir, id, "elements.json");
    return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as ElementMap) : null;
  };
  const routes = index.states
    .filter(
      (s) =>
        s.kind === "route" &&
        s.viewport === viewport &&
        s.colorScheme === "light" &&
        s.path !== "/" &&
        !/log-?in|sign-?in|\/new$/.test(s.path),
    )
    .map((s) => ({ s, map: load(s.id) }))
    .filter((x): x is { s: (typeof index.states)[number]; map: ElementMap } => x.map !== null);
  const words = aboutWords(about);
  const relevance = (x: { s: { path: string }; map: ElementMap }) => {
    if (!words.length) return 0;
    const page = [x.s.path, ...x.map.elements.filter((e) => e.role === "heading").map((e) => e.name)]
      .join(" ")
      .toLowerCase();
    return words.filter((w) => page.includes(w)).length;
  };
  const score = (x: { s: { path: string; route: string | null }; map: ElementMap }) =>
    -20 * relevance(x) +
    (x.map.elements.some((e) => e.id.startsWith("dm:")) ? 0 : 10) +
    (x.s.route?.includes("[") ? 5 : 0) +
    x.s.path.split("/").length;
  const pick = [...routes].sort((a, b) => score(a) - score(b) || a.s.path.localeCompare(b.s.path))[0];
  if (!pick) return null;
  const area = pick.map.viewport.width * pick.map.viewport.height;
  const candidates = pick.map.elements.filter(
    (e) =>
      e.visible &&
      e.inViewport &&
      e.bbox.width * e.bbox.height > area * 0.05 &&
      e.bbox.width * e.bbox.height < area * 0.45,
  );
  const focus =
    candidates.find((e) => e.id.startsWith("dm:")) ??
    candidates.find((e) => e.testId) ??
    pick.map.elements.find((e) => e.role === "heading" && (e.level ?? 9) <= 2) ??
    candidates[0];
  return focus ? { id: pick.s.id, focus: focus.id } : null;
}

/** Without an index.json (captures copied in by hand), read the meta.json files instead. */
function scanCaptures(project: Project): CaptureIndex {
  const states: CaptureIndex["states"] = [];
  const routesDir = path.join(project.paths.capturesDir, "routes");
  if (existsSync(routesDir)) {
    for (const entry of readdirSync(routesDir)) {
      const metaFile = path.join(routesDir, entry, "meta.json");
      if (!existsSync(metaFile)) continue;
      const meta = JSON.parse(readFileSync(metaFile, "utf8")) as {
        id: string;
        path: string;
        route: string | null;
        viewport: { name: string };
        colorScheme: "light" | "dark";
        capturedAt: string;
      };
      states.push({
        id: meta.id,
        kind: "route",
        route: meta.route,
        flow: null,
        step: null,
        path: meta.path,
        viewport: meta.viewport.name,
        colorScheme: meta.colorScheme,
        capturedAt: meta.capturedAt,
        gitSha: null,
        configHash: "",
        sourceHashes: {},
      });
    }
  }
  return { version: 1, updatedAt: new Date().toISOString(), gitSha: null, configHash: "", states };
}

export async function scaffoldVideo(
  project: Project,
  o: ScaffoldOptions,
): Promise<{ dir: string; files: string[]; capture: string | null }> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(o.slug))
    throw new DemovieError(
      "E_USAGE",
      `slug "${o.slug}" must be lowercase letters, digits and dashes`,
      "e.g. `npx demovie new launch --type launch`",
    );
  const preset = TYPE_PRESETS[o.type];
  const duration = o.duration ?? preset.defaultDuration;
  if (duration < preset.range[0] || duration > preset.range[1]) {
    throw new DemovieError(
      "E_USAGE",
      `${o.type} videos run ${preset.range[0]}–${preset.range[1]} s (got ${duration})`,
      `pass --duration between ${preset.range[0]} and ${preset.range[1]}`,
    );
  }
  const formats = o.formats?.length ? o.formats : preset.formats;
  const badFormat = formats.find((f) => !FormatId.safeParse(f).success);
  if (badFormat)
    throw new DemovieError(
      "E_USAGE",
      `unknown format "${badFormat}"`,
      `use ${FormatId.options.join(", ")} (comma separated)`,
    );
  const style = o.style ?? project.resolved.video.style;
  const dir = path.join(project.paths.videosDir, o.slug);
  if (existsSync(dir) && !o.force)
    throw new DemovieError(
      "E_USAGE",
      `${path.relative(process.cwd(), dir)} already exists`,
      "pick another slug, or pass --force to overwrite the scaffold",
    );
  if (existsSync(dir) && o.force) await rm(path.join(dir, "composition"), { recursive: true, force: true });
  const templates = assetDir("templates");
  const read = (f: string) => readFileSync(path.join(templates, f), "utf8");

  const glossary = existsSync(project.paths.glossaryJson)
    ? GlossarySchema.parse(JSON.parse(readFileSync(project.paths.glossaryJson, "utf8")))
    : null;
  const product = glossary?.productName ?? project.resolved.project.name;
  const tagline = glossary?.tagline ?? `${product}`;
  const ctaLabel =
    glossary?.uiLabels.find((l) => /^(start|try|get started|sign up|book a demo|request|join)/i.test(l)) ?? null;
  const url = glossary?.ctaUrl ?? null;
  const title = o.about ?? glossary?.features[0]?.term ?? product;
  const capture = pickCapture(project, o.about);
  const motion = STYLE_MOTION[style];
  const introEnd = o.type === "hero-loop" ? 2 : Math.min(3.2, duration * 0.18);
  const endLen = o.type === "hero-loop" ? 2 : Math.min(4, Math.max(2.5, duration * 0.14));
  const r = (n: number) => String(Math.round(n * 10) / 10);
  const values: Record<string, string> = {
    TYPE: o.type,
    STYLE: style,
    DURATION: String(duration),
    FORMATS: JSON.stringify(formats),
    MUSIC: String(preset.music !== "none"),
    CTA_YAML: yamlString([ctaLabel, url].filter(Boolean).join(" — ") || null),
    ABOUT_YAML: yamlString(o.about ?? null),
    WHATS_NEW:
      o.type === "changelog"
        ? "\n## What's new\n<!-- From `npx demovie changes --since <ref>`: user-visible changes only. -->\n- \n"
        : "",
    TITLE_COMMENT: `${product}${o.about ? ` — ${o.about}` : ""}`,
    TITLE: esc(title),
    TAGLINE: esc(tagline),
    EASE: motion.ease,
    DUR: String(motion.duration),
    INTRO_END: r(introEnd),
    END_LEN: r(endLen),
    CAPTURE: capture?.id ?? "",
    FOCUS: capture?.focus ?? "",
    CTA_HTML: [
      ctaLabel ? `<div class="dm-cta" data-dm-cta>${esc(ctaLabel)}</div>` : "",
      url ? `<p class="url" data-dm-cta>${esc(url)}</p>` : "",
    ].join(""),
  };
  values.MIDDLE = fill(read(capture ? "middle-product.js.tpl" : "middle-text.js.tpl"), values).trimEnd();
  const rows = [
    `| 1 | 0.0 | ${r(introEnd)} | title | Title over the brand background | ${title} | | | crossfade 0.5 | |`,
    capture
      ? `| 2 | ${r(introEnd)} | ${r(duration - introEnd - endLen)} | product | ${capture.id} in a browser frame; focus + cursor on ${capture.focus} | | | ${capture.id}#${capture.focus} | crossfade 0.5 | |`
      : `| 2 | ${r(introEnd)} | ${r(duration - introEnd - endLen)} | text | (capture the product first) | ${tagline} | | | crossfade 0.5 | |`,
    `| 3 | ${r(duration - endLen)} | ${r(endLen)} | logo | Logo + CTA | ${[ctaLabel, url].filter(Boolean).join(" · ")} | | brand logo | — | end hold |`,
  ].join("\n");
  values.ROWS = rows;

  await mkdir(path.join(dir, "composition"), { recursive: true });
  // Validate the video before writing anything, so a bad option never leaves a half-written folder.
  const video = VideoSchema.parse({
    $schema: schemaRef(project.paths.root, dir, "video.schema.json"),
    slug: o.slug,
    title: o.about ? `${product} — ${o.about}` : product,
    type: o.type,
    fps: project.resolved.video.fps,
    duration,
    formats,
    style,
    status: "brief",
    captures: capture ? [capture.id] : [],
  });
  await mkdir(path.join(dir, "audio"), { recursive: true });
  const files: string[] = [];
  const write = async (rel: string, content: string) => {
    const file = path.join(dir, rel);
    if (existsSync(file) && !o.force && rel !== "video.json") return;
    await writeFileAtomic(file, content);
    files.push(rel);
  };
  await write("brief.md", fill(read("brief.md"), values));
  await write("storyboard.md", fill(read("storyboard.md"), values));
  await write("composition/index.html", read("index.html"));
  await write("composition/main.js", fill(read("main.js.tpl"), values));
  await write("composition/styles.css", fill(read("styles.css.tpl"), values));
  await writeJson(path.join(dir, "video.json"), video);
  files.push("video.json");
  return { dir, files, capture: capture?.id ?? null };
}
