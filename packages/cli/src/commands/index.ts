import type { CommandContext } from "../context.ts";
import type { CommandResult } from "../output.ts";

export interface CommandModule {
  run: (ctx: CommandContext, ...args: any[]) => Promise<CommandResult>;
}

/** Lazy loaders for every command, so startup only loads what a command needs. */
export const commandLoaders = {
  status: () => import("./status.ts"),
  init: () => import("./init.ts"),
  doctor: () => import("./doctor.ts"),
  up: () => import("./up.ts"),
  down: () => import("./down.ts"),
  "auth-test": () => import("./auth-test.ts"),
  "auth-record": () => import("./auth-record.ts"),
  extract: () => import("./extract.ts"),
  "glossary-sync": () => import("./glossary-sync.ts"),
  capture: () => import("./capture.ts"),
  "flow-new": () => import("./flow-new.ts"),
  "flow-run": () => import("./flow-run.ts"),
  changes: () => import("./pending.ts").then((m) => m.pending("changes", "M7")),
  add: () => import("./pending.ts").then((m) => m.pending("add", "M3")),
  new: () => import("./pending.ts").then((m) => m.pending("new", "M3")),
  preview: () => import("./pending.ts").then((m) => m.pending("preview", "M3")),
  stills: () => import("./pending.ts").then((m) => m.pending("stills", "M3")),
  qa: () => import("./pending.ts").then((m) => m.pending("qa", "M4")),
  "audio-music": () => import("./pending.ts").then((m) => m.pending("audio music", "M5")),
  "audio-sfx": () => import("./pending.ts").then((m) => m.pending("audio sfx", "M5")),
  "audio-voice": () => import("./pending.ts").then((m) => m.pending("audio voice", "M5")),
  "audio-mix": () => import("./pending.ts").then((m) => m.pending("audio mix", "M5")),
  render: () => import("./pending.ts").then((m) => m.pending("render", "M3")),
  make: () => import("./pending.ts").then((m) => m.pending("make", "M6")),
  mcp: () => import("./pending.ts").then((m) => m.pending("mcp", "M6")),
  "skill-install": () => import("./pending.ts").then((m) => m.pending("skill install", "M6")),
  "ci-init": () => import("./pending.ts").then((m) => m.pending("ci init", "M7")),
} satisfies Record<string, () => Promise<CommandModule>>;

export type CommandName = keyof typeof commandLoaders;
