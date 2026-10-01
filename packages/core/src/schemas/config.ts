import { z } from "zod";
import { AgentId, FormatId, StyleId } from "./common.ts";

export const ViewportSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  deviceScaleFactor: z.number().positive().default(1),
  isMobile: z.boolean().optional(),
  hasTouch: z.boolean().optional(),
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
  version: z.string().nullable(),
  router: z.enum(["app", "pages", "both"]),
  appDir: z.string().nullable(),
  pagesDir: z.string().nullable(),
  basePath: z.string().nullable().optional(),
  i18n: z
    .object({ locales: z.array(z.string()), defaultLocale: z.string().nullable() })
    .nullable()
    .optional(),
  output: z.string().nullable().optional(),
});

export const ConfigSchema = z
  .object({
    $schema: z.string().optional(),
    version: z.literal(1),
    project: z.object({
      name: z.string().min(1),
      framework: z.enum(["nextjs", "generic"]),
      root: z.string().default("."),
      nextjs: NextjsInfoSchema.nullable().optional(),
    }),
    app: z.object({
      url: z.string().url(),
      start: z
        .object({
          command: z.string().min(1),
          cwd: z.string().default("."),
          env: z.record(z.string(), z.string()).default({}),
          readyPath: z.string().default("/"),
          timeoutMs: z.number().int().positive().default(120_000),
        })
        .nullable()
        .default(null),
      reuseRunning: z.boolean().default(true),
      headers: z
        .record(z.string(), z.string())
        .default({})
        .describe('extra HTTP headers; secrets as "$env:NAME" references'),
    }),
    demo: z
      .object({
        seed: z.string().nullable().default(null).describe("optional seed command; runs before start/capture"),
        now: IsoOrNull().describe("frozen page clock for captures"),
        timezone: z.string().default("UTC"),
        locale: z.string().default("en-US"),
        colorScheme: z.enum(["light", "dark", "both"]).default("light"),
        hide: z.array(z.string()).default([]),
        blockRequests: z.array(z.string()).default(DEFAULT_BLOCK_REQUESTS),
        mask: z
          .object({
            patterns: z.array(z.enum(["email", "phone", "secret"])).default(["email", "phone", "secret"]),
            selectors: z.array(z.string()).default([]),
            allow: z.array(z.string()).default([]),
            replacement: z.enum(["fictional", "dots"]).default("fictional"),
            enabled: z.boolean().default(true),
          })
          .prefault({}),
      })
      .prefault({}),
    auth: z
      .object({
        strategy: z.enum(["none", "form", "storageState", "script"]).default("none"),
        loginPath: z.string().nullable().default(null),
        usernameEnv: z.string().default("DEMOVIE_USER"),
        passwordEnv: z.string().default("DEMOVIE_PASSWORD"),
        successPath: z.string().nullable().default(null),
        script: z.string().nullable().default(null),
      })
      .prefault({}),
    capture: z
      .object({
        viewports: z.record(z.string(), ViewportSchema).default(DEFAULT_VIEWPORTS),
        defaultViewports: z.array(z.string()).min(1).default(["desktop"]),
        routes: z
          .object({
            include: z.array(z.string()).default(["**"]),
            exclude: z.array(z.string()).default(["/api/**"]),
            params: z.record(z.string(), z.array(z.string())).default({}),
          })
          .prefault({}),
        fullPage: z.array(z.string()).default([]),
        waitFor: z.record(z.string(), z.string()).default({}),
        concurrency: z.number().int().min(1).max(16).default(3),
        crawl: z
          .object({
            maxPages: z.number().int().positive().default(50),
            maxDepth: z.number().int().nonnegative().default(3),
          })
          .prefault({}),
      })
      .prefault({}),
    video: z
      .object({
        fps: z.number().int().min(1).max(120).default(30),
        formats: z.array(FormatId).min(1).default(["16:9", "9:16"]),
        style: StyleId.default("clean"),
      })
      .prefault({}),
    audio: z
      .object({
        music: z
          .object({
            provider: z.enum(["synth", "elevenlabs", "file", "none"]).default("synth"),
            file: z.string().nullable().optional(),
          })
          .prefault({}),
        voice: z
          .object({
            provider: z.enum(["none", "elevenlabs", "openai"]).default("none"),
            voiceId: z.string().nullable().default(null),
            model: z.string().nullable().default(null),
          })
          .prefault({}),
      })
      .prefault({}),
    agents: z.array(AgentId).default([]),
  })
  .describe("demovie project configuration (.demovie/config.json)");

function IsoOrNull() {
  return z.string().datetime({ offset: true }).nullable().default(null);
}

export type Config = z.infer<typeof ConfigSchema>;
export type ConfigInput = z.input<typeof ConfigSchema>;
