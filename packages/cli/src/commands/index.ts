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
  add: () => import("./add.ts"),
  new: () => import("./new.ts"),
  preview: () => import("./preview.ts"),
  stills: () => import("./stills.ts"),
  qa: () => import("./qa.ts"),
  "audio-music": () => import("./audio-music.ts"),
  "audio-sfx": () => import("./audio-sfx.ts"),
  "audio-voice": () => import("./audio-voice.ts"),
  "audio-mix": () => import("./audio-mix.ts"),
  render: () => import("./render.ts"),
  make: () => import("./make.ts"),
  mcp: () => import("./mcp.ts"),
  "skill-install": () => import("./skill-install.ts"),
  "ci-init": () => import("./pending.ts").then((m) => m.pending("ci init", "M7")),
} satisfies Record<string, () => Promise<CommandModule>>;

export type CommandName = keyof typeof commandLoaders;
