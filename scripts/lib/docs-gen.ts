/**
 * The reference docs that must match the code (SPEC §19): docs/config.md from the config JSON Schema,
 * docs/qa-rules.md from the QA rule registry, docs/compositions.md from the runtime's exports.
 * `pnpm docs:build` writes them; verify's docs check fails when they are stale.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { jsonSchemaFor } from "../../packages/core/src/schemas/index.ts";
import { RULES } from "../../packages/qa/src/rules.ts";
import { repoRoot } from "./repo.ts";
import { renderRuntimeApi } from "./runtime-api.ts";

type JsonSchema = {
  type?: string | string[];
  description?: string;
  default?: unknown;
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  additionalProperties?: JsonSchema | boolean;
  format?: string;
  minimum?: number;
  maximum?: number;
};

const HEADER = (source: string, script = "pnpm docs:build") =>
  `<!-- Generated from ${source} by scripts/build-docs.ts. Do not edit; run \`${script}\`. -->`;

function typeOf(s: JsonSchema): string {
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(" \\| ");
  if (s.anyOf) return s.anyOf.map(typeOf).join(" \\| ");
  const t = Array.isArray(s.type) ? s.type.join(" \\| ") : (s.type ?? "any");
  if (t === "array" && s.items) {
    const item = typeOf(s.items);
    return item.includes(" \\| ") ? `(${item})[]` : `${item}[]`;
  }
  if (t === "object" && s.additionalProperties && typeof s.additionalProperties === "object" && !s.properties)
    return `record<string, ${typeOf(s.additionalProperties)}>`;
  return t;
}

function rows(s: JsonSchema, prefix: string, out: string[]): void {
  for (const [key, child] of Object.entries(s.properties ?? {})) {
    const p = prefix ? `${prefix}.${key}` : key;
    if (key === "$schema") continue;
    const nested = child.properties ?? child.anyOf?.find((a) => a.properties)?.properties;
    const def = child.default === undefined ? "" : `\`${JSON.stringify(child.default)}\``;
    const desc = (child.description ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
    out.push(`| \`${p}\` | \`${typeOf(child)}\` | ${def.length > 60 ? "see example" : def} | ${desc} |`);
    if (nested) rows({ properties: nested }, p, out);
  }
}

export function configDoc(): string {
  const schema = jsonSchemaFor("config") as JsonSchema;
  const out: string[] = [];
  rows(schema, "", out);
  const example = path.join(repoRoot, "examples/harborly/.demovie/config.json");
  return [
    HEADER("packages/core/src/schemas/config.ts (the JSON Schema shipped as schema/config.schema.json)"),
    "# Config reference: `.demovie/config.json`",
    "",
    "`npx demovie init` writes this file; edit it freely. The JSON Schema ships with the package, and `$schema` points",
    "at it (`../node_modules/demovie/schema/config.schema.json` when demovie is installed in the project, otherwise",
    "`https://unpkg.com/demovie@<version>/schema/config.schema.json`), so editors validate and autocomplete it.",
    "",
    '- Any string of the form `"$env:NAME"` resolves from the environment or `.demovie/.env` (gitignored).',
    "- Secrets must only appear as `$env:` references.",
    "- In CI, `DEMOVIE_APP_URL`, `DEMOVIE_APP_START` and `DEMOVIE_APP_HEADERS` override `app` (see [CI](ci.md)).",
    "",
    "| Key | Type | Default | Description |",
    "|---|---|---|---|",
    ...out,
    "",
    "## Example (the Harborly fixture)",
    "",
    "```json",
    existsSync(example) ? readFileSync(example, "utf8").trim() : "{}",
    "```",
    "",
  ].join("\n");
}

export function qaRulesDoc(): string {
  const cell = (s: string) => s.replace(/\|/g, "\\|");
  return [
    HEADER("packages/qa/src/rules.ts"),
    "# QA rules",
    "",
    "`npx demovie qa <slug> [--format f|all] [--strict]` loads the composition exactly as the renderer does, samples it",
    "at 10 fps (calling `seek()` and `inspect()`, and taking screenshots where a rule needs pixels), runs every rule,",
    "writes `qa.json` next to `video.json` and exits 1 on any error. Rules listed in `video.json` `qa.ignore` are",
    "reported as waived; `--strict` turns warnings into errors. `npx demovie preview <slug>` draws the failures over the",
    "frames.",
    "",
    "| ID | Severity | Rule | Measurement | Fix |",
    "|---|---|---|---|---|",
    ...RULES.map((r) => `| ${r.id} | ${r.severity} | ${cell(r.title)} | ${cell(r.measurement)} | ${cell(r.fix)} |`),
    "",
  ].join("\n");
}

export function compositionsDoc(): string {
  // the skill's runtime-api.md without its generated header and title, one heading level down
  const api = renderRuntimeApi()
    .split("\n")
    .slice(2)
    .join("\n")
    .replace(/^(#{2,3}) /gm, "#$1 ");
  return [
    HEADER("packages/runtime/src/index.ts"),
    "# Compositions",
    "",
    "A video is a folder: `brief.md`, `storyboard.md`, `video.json`, `composition/` (`index.html`, `main.js`,",
    "`styles.css`) and `audio/`. `npx demovie new <slug> --type … --style …` scaffolds one. The composition is a web",
    "page: `index.html` loads `/__demovie/clock.js` (a virtual clock) and the runtime CSS, and `main.js` imports the",
    "runtime, builds a GSAP timeline and calls `v.ready()`. The renderer seeks it frame by frame.",
    "",
    "Served paths: `/__demovie/*` (runtime, clock, CSS, GSAP, fonts, SFX), `/brand/*`, `/captures/*`, `/assets/*`,",
    "`/audio/*` (the video's audio folder), `/video.json` and `/glossary.json`; composition-relative files resolve",
    "normally and `.ts` files are transpiled on the fly. Nothing else is reachable: every other request is blocked.",
    "",
    "Rules that keep videos true and renderable:",
    "",
    "- Product UI only through `screen()` with a capture id; targets are element ids from the capture's `elements.json`.",
    "- Everything is a pure function of time: tweens on `v.timeline` or the helpers, `v.css()` for CSS animations,",
    "  `v.onSeek()` for canvas, `v.random(seed)` instead of `Math.random`, no timers after `ready()`.",
    "- Declare every shot with `v.shot(id, start, end, { kind })`; mark the CTA with `data-dm-cta`.",
    "",
    "`npx demovie preview <slug>` serves a player with scrubbing, frame stepping, safe-area and grid guides, a QA overlay",
    "and hot reload. See [styles](styles.md) for the presets and the reference compositions in `examples/compositions`.",
    "",
    "## Runtime API",
    api,
  ].join("\n");
}

/** Generated docs, keyed by their repo-relative path. */
export function generatedDocs(): [string, string][] {
  return [
    ["docs/config.md", configDoc()],
    ["docs/qa-rules.md", qaRulesDoc()],
    ["docs/compositions.md", compositionsDoc()],
  ];
}
