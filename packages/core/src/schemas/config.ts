import { z } from "zod";
import { AgentId, FormatId, StyleId } from "./common.ts";

export const ViewportSchema = z.object({
  width: z.number().int().positive().describe("CSS pixels"),
  height: z.number().int().positive().describe("CSS pixels"),
  deviceScaleFactor: z.number().positive().default(1).describe("screenshot pixels per CSS pixel"),
  isMobile: z.boolean().optional().describe("emulate a mobile browser (meta viewport, touch)"),
  hasTouch: z.boolean().optional().describe("emulate touch support"),
});
export type Viewport = z.infer<typeof ViewportSchema>;

export const DEFAULT_VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 2 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true },
} satisfies Record<string, Viewport>;

export const DEFAULT_BLOCK_REQUESTS = [
  "*google-analytics.com*",
  "*googletagmanager.com*",
  "*posthog.com*",
  "*segment.io*",
  "*hotjar.com*",
];

export const NextjsInfoSchema = z.object({
  version: z.string().nullable().describe("detected Next.js version"),
  router: z.enum(["app", "pages", "both"]).describe("which routers the app uses"),
  appDir: z.string().nullable().describe("App Router folder, e.g. src/app"),
  pagesDir: z.string().nullable().describe("Pages Router folder, e.g. pages"),
  basePath: z.string().nullable().optional().describe("next.config basePath"),
  i18n: z
    .object({ locales: z.array(z.string()), defaultLocale: z.string().nullable() })
    .nullable()
    .optional()
    .describe("next.config i18n (Pages Router)"),
  output: z.string().nullable().optional().describe('next.config output, e.g. "standalone"'),
});

export const ConfigSchema = z
  .object({
    $schema: z.string().optional().describe("JSON Schema for editors; written by init"),
    version: z.literal(1).describe("config format version"),
    project: z
      .object({
        name: z.string().min(1).describe("product name used in videos"),
        framework: z
          .enum(["nextjs", "generic"])
          .describe("nextjs: routes from the file system; generic: crawl app.url"),
        root: z.string().default(".").describe("the app folder, relative to the folder that holds .demovie/"),
        nextjs: NextjsInfoSchema.nullable().optional().describe("what init detected (Next.js only)"),
      })
      .describe("the app demovie works on"),
    app: z
      .object({
        url: z.string().url().describe("where the running app answers"),
        start: z
          .object({
            command: z.string().min(1).describe("starts the app, e.g. pnpm dev"),
            cwd: z.string().default(".").describe("folder to run it in, relative to the project"),
            env: z.record(z.string(), z.string()).default({}).describe("extra environment variables"),
            readyPath: z.string().default("/").describe("path polled until the app answers"),
            timeoutMs: z.number().int().positive().default(120_000).describe("how long to wait for readyPath"),
          })
          .nullable()
          .default(null)
          .describe("how up and capture start the app; null when you start it yourself"),
        reuseRunning: z.boolean().default(true).describe("use the app if it already answers at url"),
        headers: z
          .record(z.string(), z.string())
          .default({})
          .describe('extra HTTP headers; secrets as "$env:NAME" references'),
      })
      .describe("how to reach and start the app"),
    demo: z
      .object({
        seed: z.string().nullable().default(null).describe("optional seed command; runs before start/capture"),
        now: IsoOrNull().describe("frozen page clock for captures"),
        timezone: z.string().default("UTC").describe("browser timezone for captures"),
        locale: z.string().default("en-US").describe("browser locale for captures"),
        colorScheme: z.enum(["light", "dark", "both"]).default("light").describe("color schemes to capture"),
        hide: z
          .array(z.string())
          .default([])
          .describe("CSS selectors hidden before screenshots (cookie banners, chat)"),
        blockRequests: z
          .array(z.string())
          .default(DEFAULT_BLOCK_REQUESTS)
          .describe("URL patterns (* wildcards) aborted during capture"),
        mask: z
          .object({
            patterns: z
              .array(z.enum(["email", "phone", "secret"]))
              .default(["email", "phone", "secret"])
              .describe("kinds of text replaced before screenshots"),
            selectors: z.array(z.string()).default([]).describe("CSS selectors whose text is masked entirely"),
            allow: z.array(z.string()).default([]).describe("values never masked, e.g. *@harborly.demo"),
            replacement: z
              .enum(["fictional", "dots"])
              .default("fictional")
              .describe("fictional look-alikes of similar length, or •••"),
            enabled: z.boolean().default(true).describe("turn redaction off only for fully fictional apps"),
          })
          .prefault({})
          .describe("redaction of personal data in captures"),
      })
      .prefault({})
      .describe("demo mode: seeded data, frozen clock, hidden and masked content"),
    auth: z
      .object({
        strategy: z
          .enum(["none", "form", "storageState", "script"])
          .default("none")
          .describe("form: fill the login page; storageState: a session saved by auth record; script: your own code"),
        loginPath: z.string().nullable().default(null).describe("login page path (form)"),
        usernameEnv: z.string().default("DEMOVIE_USER").describe("env var holding the demo username (form)"),
        passwordEnv: z.string().default("DEMOVIE_PASSWORD").describe("env var holding the demo password (form)"),
        successPath: z.string().nullable().default(null).describe("path reached after a successful login"),
        script: z.string().nullable().default(null).describe("auth script path (script); default .demovie/auth.ts"),
      })
      .prefault({})
      .describe("how captures log in to protected pages"),
    capture: z
      .object({
        viewports: z.record(z.string(), ViewportSchema).default(DEFAULT_VIEWPORTS).describe("named viewports"),
        defaultViewports: z
          .array(z.string())
          .min(1)
          .default(["desktop"])
          .describe("viewports captured when --viewport isn't given"),
        routes: z
          .object({
            include: z.array(z.string()).default(["**"]).describe("route globs to capture"),
            exclude: z.array(z.string()).default(["/api/**"]).describe("route globs to skip"),
            params: z
              .record(z.string(), z.array(z.string()))
              .default({})
              .describe('values for dynamic routes, e.g. { "/app/projects/[id]": ["prj_launch"] }'),
          })
          .prefault({})
          .describe("which routes capture visits"),
        fullPage: z.array(z.string()).default([]).describe("route globs that also get a full-page screenshot"),
        waitFor: z
          .record(z.string(), z.string())
          .default({})
          .describe('per-route CSS selector to wait for, e.g. { "/app": "main" }'),
        concurrency: z.number().int().min(1).max(16).default(3).describe("pages captured in parallel"),
        crawl: z
          .object({
            maxPages: z.number().int().positive().default(50).describe("most pages a generic-mode crawl visits"),
            maxDepth: z.number().int().nonnegative().default(3).describe("most links followed from app.url"),
          })
          .prefault({})
          .describe("route discovery for generic apps"),
      })
      .prefault({})
      .describe("screenshots and element maps"),
    video: z
      .object({
        fps: z.number().int().min(1).max(120).default(30).describe("frame rate of new videos"),
        formats: z.array(FormatId).min(1).default(["16:9", "9:16"]).describe("formats of new videos"),
        style: StyleId.default("clean").describe("style preset of new videos"),
      })
      .prefault({})
      .describe("defaults for demovie new"),
    audio: z
      .object({
        music: z
          .object({
            provider: z
              .enum(["synth", "elevenlabs", "file", "none"])
              .default("synth")
              .describe("synth: free and local; elevenlabs: your key; file: a track imported with add --licensed"),
          })
          .prefault({})
          .describe("background music"),
        voice: z
          .object({
            provider: z
              .enum(["none", "elevenlabs", "openai"])
              .default("none")
              .describe("voiceover provider; uses your API key after you approve the cost"),
            voiceId: z.string().nullable().default(null).describe("provider voice id (default: the provider's)"),
            model: z.string().nullable().default(null).describe("provider model id (default: the provider's)"),
          })
          .prefault({})
          .describe("voiceover"),
      })
      .prefault({})
      .describe("default audio providers"),
    agents: z.array(AgentId).default([]).describe("agents init set up the skill and MCP for"),
  })
  .describe("demovie project configuration (.demovie/config.json)");

function IsoOrNull() {
  return z.string().datetime({ offset: true }).nullable().default(null);
}

export type Config = z.infer<typeof ConfigSchema>;
export type ConfigInput = z.input<typeof ConfigSchema>;
