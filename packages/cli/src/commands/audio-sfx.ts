import path from "node:path";
import type { CommandContext } from "../context.ts";
import type { CommandResult } from "../output.ts";

/** `demovie audio sfx [--list]` (SPEC §13.2): the bundled, generated CC0 set. */
export async function run(ctx: CommandContext, _options: { list?: boolean }): Promise<CommandResult> {
  const { listSfx } = await import("@demovie/audio");
  const sfx = listSfx();
  return {
    data: { sfx: sfx.map((s) => ({ ...s, file: path.relative(ctx.cwd, s.file) })) },
    human: [
      ...sfx.map(
        (s) => `${s.name.padEnd(13)} ${s.duration.toFixed(2).padStart(5)} s  ${s.license ?? "?"}  ${s.description}`,
      ),
      'Use them in video.json: "sfx": [{ "name": "whoosh-short", "at": 4.0, "gain": -10 }], then `npx demovie audio mix <slug>`',
    ],
  };
}
