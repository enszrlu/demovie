import { VERSION } from "@demovie/core";
import { Command, Option } from "commander";
import { type CommandName, commandLoaders } from "./commands/index.ts";
import { type CommandContext, createContext, type GlobalOptions } from "./context.ts";
import { type CommandResult, emitError, emitResult } from "./output.ts";

type Handler = (ctx: CommandContext, ...args: any[]) => Promise<CommandResult>;
type Loader = () => Promise<Handler>;

/**
 * Wraps a lazily-loaded command handler: builds the context from global options,
 * runs the handler, and prints JSON or human output. Heavy modules load only when used.
 */
function action(load: Loader) {
  return async (...args: unknown[]) => {
    const command = args[args.length - 1] as Command;
    let ctx: CommandContext | undefined;
    try {
      ctx = createContext(command.optsWithGlobals() as GlobalOptions);
      const handler = await load();
      const positional = args.slice(0, -2);
      const options = command.opts();
      const result = await handler(ctx, ...positional, options);
      emitResult(ctx, result);
    } catch (error) {
      emitError(ctx, error);
    }
  };
}

const commaList = (value: string, previous: string[] = []): string[] => [
  ...previous,
  ...value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
];
const number = (value: string): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`expected a number, got "${value}"`);
  return n;
};

const load =
  (name: CommandName): Loader =>
  async () =>
    (await commandLoaders[name]()).run as Handler;

export function buildProgram(): Command {
  const program = new Command("demovie");
  // Usage errors exit with 2 (SPEC §7); help and version exit with 0. Subcommands inherit this.
  program.exitOverride((err) => {
    if (err.code === "commander.helpDisplayed" || err.code === "commander.version" || err.code === "commander.help") {
      process.exit(0);
    }
    process.exit(2);
  });
  program
    .allowExcessArguments(true)
    .description(
      "Accurate, on-brand motion-graphics videos of your real web app. Your agent animates. demovie makes it true.",
    )
    .version(VERSION, "-v, --version", "print the demovie version")
    .option("--cwd <dir>", "run as if demovie was started in <dir>")
    .option("--json", "machine-readable output on stdout; logs go to stderr")
    .option("--verbose", "verbose logging")
    .option("-y, --yes", "accept defaults and never prompt")
    .option("--no-color", "disable colors")
    .showHelpAfterError("(run with --help for usage)")
    .action(async (...args: unknown[]) => {
      const command = args[args.length - 1] as Command;
      if (command.args.length > 0) {
        process.stderr.write(
          `error: unknown command "${command.args[0]}"\nfix: run \`demovie --help\` to list commands\n`,
        );
        process.exitCode = 2;
        return;
      }
      await action(load("status"))(...args);
    });

  program
    .command("init")
    .description("detect the app, extract brand/glossary/routes, set up demo mode + login, install the agent skill")
    .option("--url <url>", "app URL (generic mode when no framework is detected)")
    .addOption(new Option("--framework <name>", "force a framework").choices(["nextjs", "generic"]))
    .option("--app <path>", "app folder inside a monorepo")
    .option("--agents <list>", "agents to set up: claude,codex,cursor", commaList)
    .option("--about <text>", "one-line product description used to seed glossary.md")
    .option("--start <command>", "command that starts the app")
    .option("--seed <command>", "demo data seed command")
    .addOption(new Option("--auth <strategy>", "auth strategy").choices(["none", "form", "storageState", "script"]))
    .option("--login-path <path>", "login page path")
    .option("--success-path <path>", "path reached after login")
    .option("--no-extract", "skip brand/glossary/routes extraction")
    .option("--no-skill", "skip installing the agent skill")
    .action(action(load("init")));

  program
    .command("doctor")
    .description("check Node, ffmpeg, ffprobe, Chromium, config, app reachability, auth and git")
    .option("--fix", "install Chromium via Playwright and create missing folders")
    .action(action(load("doctor")));

  program
    .command("status")
    .description("project state and the next step")
    .action(action(load("status")));

  program
    .command("up")
    .description("start the app in demo mode (seed → start → wait)")
    .action(action(load("up")));
  program
    .command("down")
    .description("stop what `up` started")
    .action(action(load("down")));

  const auth = program.command("auth").description("verify or record the login");
  auth
    .command("test")
    .description("verify that login works")
    .action(action(load("auth-test")));
  auth
    .command("record")
    .description("open a headed browser, log in manually, save the storage state")
    .action(action(load("auth-record")));

  program
    .command("extract")
    .description("re-run the extractors (static, plus runtime when the app is reachable)")
    .argument("[what]", "brand | glossary | routes | all", "all")
    .action(action(load("extract")));

  const glossary = program.command("glossary").description("glossary tools");
  glossary
    .command("sync")
    .description("regenerate glossary.json from glossary.md")
    .action(action(load("glossary-sync")));

  program
    .command("capture")
    .description("capture real screens, flows and element maps")
    .option("--route <glob...>", "route globs to capture")
    .option("--flow <name...>", "flows to run")
    .option("--viewport <name...>", "viewports to use")
    .option("--dark", "also capture dark mode")
    .option("--full-page", "also write full-page screenshots")
    .option("--changed", "only re-capture stale or affected states")
    .option("--since <ref>", "with --changed: git ref to compare against")
    .action(action(load("capture")));

  const flow = program.command("flow").description("user flows");
  flow
    .command("new")
    .description("scaffold a flow file")
    .argument("<name>", "flow name")
    .option("--start <path>", "start path")
    .option("--ts", "write a TypeScript flow instead of YAML")
    .action(action(load("flow-new")));
  flow
    .command("run")
    .description("run a single flow")
    .argument("<name>", "flow name")
    .action(action(load("flow-run")));

  program
    .command("changes")
    .description("summarize changes and affected routes")
    .option("--since <ref>", "git ref (default: latest tag, else the last 20 commits)")
    .action(action(load("changes")));

  program
    .command("add")
    .description("import resources into .demovie/assets")
    .argument("<files...>", "files to import")
    .option("--describe <text>", "what the resource is")
    .option("--licensed", "confirm you hold a license for imported audio")
    .action(action(load("add")));

  program
    .command("new")
    .description("scaffold a video folder from a type preset and style template")
    .argument("<slug>", "video slug")
    .addOption(
      new Option("--type <type>", "video type")
        .choices(["launch", "feature", "changelog", "teaser", "walkthrough", "hero-loop"])
        .makeOptionMandatory(),
    )
    .option("--duration <seconds>", "duration in seconds", number)
    .option("--format <list>", "formats: 16:9,9:16,1:1,4:5", commaList)
    .addOption(
      new Option("--style <style>", "style preset").choices(["clean", "bold", "soft", "editorial", "terminal"]),
    )
    .option("--about <text>", "what the video is about")
    .option("--force", "overwrite an existing video folder")
    .action(action(load("new")));

  program
    .command("preview")
    .description("preview player with scrubbing, safe areas and QA overlay")
    .argument("<slug>", "video slug or path")
    .option("--port <port>", "port", number, 4400)
    .option("--no-open", "do not open the browser")
    .action(action(load("preview")));

  program
    .command("stills")
    .description("render still frames and a contact sheet")
    .argument("<slug>", "video slug or path")
    .option("--at <times>", "times in seconds, comma separated", commaList)
    .option("--every <seconds>", "one still every N seconds", number)
    .option("--format <format>", "format (default: the first format)")
    .option("--sheet", "also write a contact sheet")
    .option("--scale <n>", "render scale", number, 0.5)
    .action(action(load("stills")));

  program
    .command("qa")
    .description("run the QA rules")
    .argument("<slug>", "video slug or path")
    .option("--format <format>", "format or `all`", "all")
    .option("--strict", "treat warnings as errors")
    .option("--fps <n>", "sampling rate", number)
    .action(action(load("qa")));

  const audio = program.command("audio").description("music, SFX, voice and mixing");
  audio
    .command("music")
    .description("synthesize music plus beats.json")
    .argument("<slug>", "video slug or path")
    .option("--bpm <n>", "tempo (80–140)", number)
    .addOption(new Option("--mood <mood>", "mood").choices(["uplifting", "tech", "calm", "energetic", "minimal"]))
    .addOption(new Option("--provider <provider>", "music provider").choices(["synth", "elevenlabs"]))
    .option("--seed <seed>", "random seed")
    .action(action(load("audio-music")));
  audio
    .command("sfx")
    .description("list bundled SFX")
    .option("--list", "list the bundled SFX")
    .action(action(load("audio-sfx")));
  audio
    .command("voice")
    .description("synthesize voiceover lines from the storyboard (prints a cost estimate first)")
    .argument("<slug>", "video slug or path")
    .addOption(new Option("--provider <provider>", "TTS provider").choices(["elevenlabs", "openai"]))
    .option("--voice <id>", "voice id")
    .option("--model <id>", "model id")
    .action(action(load("audio-voice")));
  audio
    .command("mix")
    .description("mix music + VO + SFX and normalize loudness into mix.wav")
    .argument("<slug>", "video slug or path")
    .action(action(load("audio-mix")));

  program
    .command("render")
    .description("render MP4s (and optional GIF/WebM)")
    .argument("<slug>", "video slug or path")
    .option("--format <format>", "format or `all`", "all")
    .addOption(new Option("--quality <quality>", "quality").choices(["draft", "final"]).default("final"))
    .option("--scale <n>", "render scale", number)
    .option("--fps <n>", "frames per second", number)
    .option("--gif", "also write preview.gif")
    .option("--webm", "also write a VP9 WebM")
    .option("--workers <n>", "parallel browser pages", number)
    .action(action(load("render")));

  program
    .command("make")
    .description("launch your own agent CLI with the demovie skill")
    .addOption(new Option("--agent <agent>", "agent").choices(["claude", "codex", "cursor", "custom"]))
    .option("--agent-cmd <template>", 'custom agent command, e.g. "mytool run {prompt}"')
    .option("--model <model>", "model passed to the agent")
    .addOption(
      new Option("--type <type>", "video type").choices([
        "launch",
        "feature",
        "changelog",
        "teaser",
        "walkthrough",
        "hero-loop",
      ]),
    )
    .option("--duration <seconds>", "duration in seconds", number)
    .option("--format <list>", "formats", commaList)
    .option("--about <text>", "what the video is about")
    .option("--resources <files>", "resource files", commaList)
    .option("--voice", "voiceover on")
    .option("--review", "review the brief and storyboard before animating")
    .option("--no-review", "work autonomously")
    .option("--dry-run", "print the exact agent command and exit")
    .action(action(load("make")));

  program
    .command("mcp")
    .description("start the MCP server on stdio")
    .action(action(load("mcp")));

  const skill = program.command("skill").description("the demovie Agent Skill");
  skill
    .command("install")
    .description("install or update the Agent Skill (project-level by default)")
    .option("--agent <list>", "agents: claude,codex,cursor", commaList)
    .option("--global", "install into the user-level skill folder (explicit request only)")
    .action(action(load("skill-install")));

  const ci = program.command("ci").description("continuous integration");
  ci.command("init")
    .description("write .github/workflows/demovie.yml (asks for confirmation)")
    .addOption(new Option("--provider <provider>", "CI provider").choices(["github"]).default("github"))
    .action(action(load("ci-init")));

  return program;
}
