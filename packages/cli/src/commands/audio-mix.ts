import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DemovieError, loadProject, sha256, toPosix, VoiceManifestSchema } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import { resolveAudioSrc } from "../lib/audio.ts";
import type { CommandResult } from "../output.ts";

/** `demovie audio mix <slug>` (SPEC §11.4): music + VO + SFX → two-pass loudnorm → audio/mix.wav. */
export async function run(ctx: CommandContext, slug: string): Promise<CommandResult> {
  const project = await loadProject(ctx.cwd);
  const { resolveVideo } = await import("@demovie/render");
  const audio = await import("@demovie/audio");
  const video = await resolveVideo(project, slug, ctx.cwd);
  const cfg = video.video.audio;
  const rel = (f: string) => path.relative(ctx.cwd, f);

  let music: { file: string; gain: number } | null = null;
  if (cfg.music) {
    const file = resolveAudioSrc(project, video.dir, cfg.music.src);
    if (!existsSync(file))
      throw new DemovieError(
        "E_NOT_FOUND",
        `music file ${cfg.music.src} does not exist`,
        `run \`npx demovie audio music ${video.slug}\`, or fix audio.music.src in video.json`,
      );
    music = { file, gain: cfg.music.gain };
  }
  let voice: { file: string; start: number; duration: number }[] = [];
  if (cfg.voice) {
    const manifestFile = path.join(video.dir, cfg.voice.manifest);
    if (!existsSync(manifestFile))
      throw new DemovieError(
        "E_NOT_FOUND",
        `${cfg.voice.manifest} does not exist`,
        `run \`npx demovie audio voice ${video.slug}\`, or remove audio.voice from video.json`,
      );
    const manifest = VoiceManifestSchema.parse(JSON.parse(await readFile(manifestFile, "utf8")));
    voice = manifest.lines.map((l) => ({ file: path.join(video.dir, l.file), start: l.start, duration: l.duration }));
    const missing = voice.find((l) => !existsSync(l.file));
    if (missing)
      throw new DemovieError(
        "E_NOT_FOUND",
        `${rel(missing.file)} is missing`,
        `re-run \`npx demovie audio voice ${video.slug}\``,
      );
  }
  const sfx = cfg.sfx.map((cue) => {
    if (!audio.isSfxName(cue.name)) {
      throw new DemovieError(
        "E_CONFIG",
        `unknown SFX "${cue.name}" in video.json audio.sfx`,
        `use one of: ${audio.SFX_NAMES.join(", ")} (\`npx demovie audio sfx --list\`)`,
      );
    }
    if (cue.at >= video.video.duration)
      throw new DemovieError(
        "E_CONFIG",
        `SFX "${cue.name}" at ${cue.at} s starts after the end of the video`,
        "move it inside the video's duration in video.json audio.sfx",
      );
    return { name: cue.name, file: audio.sfxFile(cue.name), at: cue.at, gain: cue.gain };
  });
  const target = { lufs: cfg.loudness.targetLufs, truePeak: cfg.loudness.truePeak };
  const input = { duration: video.video.duration, music, voice, sfx, target };
  const out = path.join(video.audioDir, "mix.wav");
  const started = Date.now();
  const result = await audio.mixAudio(input, out, path.join(project.paths.cacheDir, "audio"));
  await audio.recordProvenance(video.audioDir, [
    {
      file: "mix.wav",
      kind: "mix",
      generator: "demovie-mix",
      license: null,
      details: {
        inputs: [
          ...(cfg.music ? [cfg.music.src] : []),
          ...voice.map((l) => toPosix(path.relative(video.dir, l.file))),
          ...[...new Set(sfx.map((s) => `sfx:${s.name}`))],
        ],
        inputsHash: result.inputsHash,
        target,
        sha256: sha256(await readFile(out)),
      },
    },
  ]);
  const { integrated, truePeak, range } = result.loudness;
  const offTarget = Math.abs(integrated - target.lufs) > 1;
  return {
    data: {
      file: rel(out),
      loudness: result.loudness,
      target,
      normalization: result.normalization,
      limited: result.limited,
      inputs: { music: music ? rel(music.file) : null, voice: voice.length, sfx: sfx.length },
      ms: Date.now() - started,
    },
    human: [
      `${rel(out)} · ${integrated.toFixed(1)} LUFS (target ${target.lufs}) · true peak ${truePeak.toFixed(1)} dBTP · LRA ${range.toFixed(1)} LU`,
      `inputs: ${music ? "music" : "no music"}, ${voice.length} VO line(s), ${sfx.length} SFX cue(s)${result.limited ? " · peaks limited before loudnorm" : ""}`,
      ...(offTarget ? [`warn: loudness is more than 1 LU off target (${result.normalization} normalization)`] : []),
      `Next: \`npx demovie render ${video.slug}\``,
    ],
  };
}
