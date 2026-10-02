/**
 * The reference docs that must match the code (SPEC §19): docs/config.md from the config JSON Schema, docs/cli.md
 * from the commander program, docs/qa-rules.md from the QA rule registry, docs/compositions.md from the runtime's
 * exports.
 * `pnpm docs:build` writes them; verify's docs check fails when they are stale.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { EXAMPLES } from "../../packages/cli/src/help-examples.ts";
import { buildProgram } from "../../packages/cli/src/program.ts";
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

type Command = ReturnType<typeof buildProgram>;

/** Commands by task, in the order a project uses them. */
const CLI_SECTIONS: [string, string, string[]][] = [
  ["Set up and check", "Get a project ready and keep it healthy.", ["init", "doctor", "status", "up", "down", "clean"]],
  ["Log in", "For apps with a login (see [capture and auth](capture-and-auth.md)).", ["auth test", "auth record"]],
  ["Know the product", "The brand, vocabulary and routes demovie reads from your code.", ["extract", "glossary sync"]],
  [
    "Capture",
    "Screenshots and element maps of the running app.",
    ["capture", "flow new", "flow run", "changes", "add"],
  ],
  [
    "Make a video",
    "Scaffold, look, check and render (your agent runs these for you).",
    ["new", "preview", "stills", "qa", "render"],
  ],
  [
    "Audio",
    "Music, sound effects, voiceover and the final mix.",
    ["audio music", "audio sfx", "audio voice", "audio mix"],
  ],
  ["Agents", "Hand the work to your coding agent.", ["make", "mcp", "skill install"]],
  ["Continuous integration", "A video for every release.", ["ci init"]],
];

const anchor = (key: string) => `demovie-${key.replace(/ /g, "-")}`;

/** docs/cli.md: every command with its arguments, options and examples, from the commander program itself. */
export function cliDoc(): string {
  const program = buildProgram();
  const commands = new Map<string, Command>();
  const walk = (cmd: Command, prefix: string[]) => {
    for (const sub of cmd.commands) {
      if (sub.name() === "help") continue;
      const key = [...prefix, sub.name()].join(" ");
      if (sub.commands.length === 0) commands.set(key, sub);
      walk(sub, [...prefix, sub.name()]);
    }
  };
  walk(program, []);
  const listed = CLI_SECTIONS.flatMap(([, , keys]) => keys);
  const missing = [...commands.keys()].filter((key) => !listed.includes(key));
  if (missing.length)
    throw new Error(`docs/cli.md: add ${missing.join(", ")} to CLI_SECTIONS in scripts/lib/docs-gen.ts`);
  const cell = (s: string) => s.replace(/\|/g, "\\|");
  const out = [
    HEADER("packages/cli/src/program.ts and packages/cli/src/help-examples.ts"),
    "# Command reference",
    "",
    "Every command, with its options and examples. The same examples appear under `npx demovie <command> --help`.",
    "Run commands from your app's folder (the one with `.demovie/`), or point at it with `--cwd`.",
    "",
    "| Command | What it does |",
    "|---|---|",
    ...listed.map((key) => `| [\`${key}\`](#${anchor(key)}) | ${cell(commands.get(key)!.description())} |`),
    "",
    "## Global options",
    "",
    "These work with every command.",
    "",
    "| Option | What it does |",
    "|---|---|",
    ...program.options.map((o) => `| \`${o.flags}\` | ${cell(o.description)} |`),
    "",
  ];
  for (const [title, intro, keys] of CLI_SECTIONS) {
    out.push(`## ${title}`, "", intro, "");
    for (const key of keys) {
      const cmd = commands.get(key)!;
      out.push(`### demovie ${key}`, "", `${cmd.description().replace(/^./, (c) => c.toUpperCase())}.`, "");
      out.push("```bash", `npx demovie ${key} ${cmd.usage()}`.trimEnd(), "```", "");
      const args = cmd.registeredArguments;
      if (args.length) {
        out.push("| Argument | What it is |", "|---|---|");
        for (const a of args)
          out.push(`| \`${a.name()}\`${a.required ? "" : " (optional)"} | ${cell(a.description || "")} |`);
        out.push("");
      }
      const options = cmd.options.filter((o) => o.long !== "--help");
      if (options.length) {
        out.push("| Option | What it does | Default |", "|---|---|---|");
        for (const o of options) {
          const choices = o.argChoices?.length ? ` (one of: ${o.argChoices.map((c) => `\`${c}\``).join(", ")})` : "";
          const def =
            o.defaultValue === undefined || typeof o.defaultValue === "boolean" ? "" : `\`${String(o.defaultValue)}\``;
          out.push(`| \`${o.flags}\` | ${cell(o.description)}${choices} | ${def} |`);
        }
        out.push("");
      }
      const examples = EXAMPLES[key] ?? [];
      if (examples.length) out.push("```bash", ...examples.flatMap(([what, line]) => [`# ${what}`, line]), "```", "");
    }
  }
  out.push(
    "## Exit codes",
    "",
    "| Code | Meaning |",
    "|---|---|",
    "| 0 | Success |",
    "| 1 | The command failed, or QA found errors |",
    "| 2 | Usage or config error |",
    "| 3 | A prerequisite is missing (Node, ffmpeg, Chromium) |",
    "| 4 | The app is unreachable, or login failed |",
    "",
    "With `--json`, output is one JSON document on stdout and errors are",
    '`{ "ok": false, "error": { "code", "message", "fix" } }`. Logs always go to stderr.',
    "",
  );
  return out.join("\n");
}

/** Generated docs, keyed by their repo-relative path. */
export function generatedDocs(): [string, string][] {
  return [
    ["docs/config.md", configDoc()],
    ["docs/qa-rules.md", qaRulesDoc()],
    ["docs/compositions.md", compositionsDoc()],
    ["docs/cli.md", cliDoc()],
  ];
}
