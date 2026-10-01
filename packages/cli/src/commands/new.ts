import path from "node:path";
import { type FormatId, loadProject, type StyleId, type VideoType } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import { scaffoldVideo } from "../lib/scaffold.ts";
import type { CommandResult } from "../output.ts";

export async function run(
  ctx: CommandContext,
  slug: string,
  options: { type: VideoType; duration?: number; format?: string[]; style?: StyleId; about?: string; force?: boolean },
): Promise<CommandResult> {
  const project = await loadProject(ctx.cwd);
  const result = await scaffoldVideo(project, {
    slug,
    type: options.type,
    duration: options.duration,
    formats: options.format as FormatId[] | undefined,
    style: options.style,
    about: options.about,
    force: options.force,
  });
  const rel = path.relative(ctx.cwd, result.dir) || ".";
  return {
    data: { slug, dir: rel, files: result.files, capture: result.capture },
    human: [
      `scaffolded ${rel}: ${result.files.join(", ")}`,
      result.capture
        ? `starts from capture ${result.capture}`
        : "no captures yet: run `npx demovie capture` and add a product shot",
      `Next: fill brief.md and storyboard.md, then \`npx demovie stills ${slug} --every 2 --sheet\``,
    ],
  };
}
