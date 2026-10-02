import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DemovieError, loadProject, readStoryboard } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import { confirmCost, requireKey, updateVideoJson } from "../lib/audio.ts";
import type { CommandResult } from "../output.ts";

export interface VoiceCliOptions {
  provider?: "elevenlabs" | "openai";
  voice?: string;
  model?: string;
  script?: string;
}

/** `demovie audio voice <slug>` (SPEC §13.3): VO lines → provider TTS (cached) → voice.json, captions, provenance. */
export async function run(ctx: CommandContext, slug: string, options: VoiceCliOptions): Promise<CommandResult> {
  const project = await loadProject(ctx.cwd);
  const { resolveVideo } = await import("@demovie/render");
  const audio = await import("@demovie/audio");
  const video = await resolveVideo(project, slug, ctx.cwd);
  const configured = project.resolved.audio.voice;
  const providerId = options.provider ?? configured.provider;
  if (providerId === "none") {
    throw new DemovieError(
      "E_USAGE",
      'voiceover is off for this project (audio.voice.provider is "none")',
      "pass --provider elevenlabs|openai, or set audio.voice.provider in .demovie/config.json",
    );
  }
  const provider = audio.VOICE_PROVIDERS[providerId];
  const voice = options.voice ?? configured.voiceId ?? provider.defaultVoice;
  const model = options.model ?? configured.model ?? provider.defaultModel;

  let lines: ReturnType<typeof audio.linesFromStoryboard>;
  let source: string;
  if (options.script) {
    const file = path.resolve(ctx.cwd, options.script);
    if (!existsSync(file))
      throw new DemovieError(
        "E_NOT_FOUND",
        `${options.script} does not exist`,
        "pass --script <file> with one VO line per line",
      );
    lines = audio.parseScript(await readFile(file, "utf8"));
    source = path.relative(ctx.cwd, file);
  } else {
    const sbFile = path.join(video.dir, "storyboard.md");
    if (!existsSync(sbFile))
      throw new DemovieError(
        "E_NOT_FOUND",
        `${path.relative(ctx.cwd, sbFile)} is missing`,
        "write the storyboard first, or pass --script <file>",
      );
    lines = audio.linesFromStoryboard(await readStoryboard(sbFile));
    source = path.relative(ctx.cwd, sbFile);
  }
  if (lines.length === 0)
    throw new DemovieError(
      "E_USAGE",
      `${source} has no VO lines`,
      'fill the "VO line" column in storyboard.md, or pass --script <file>',
    );
  const tooLong = lines.find((l) => l.text.length > 4096);
  if (tooLong)
    throw new DemovieError(
      "E_USAGE",
      `VO line ${tooLong.id} is longer than 4096 characters`,
      "split it into shorter lines",
    );

  const apiKey = requireKey(project, provider.envKey, `${provider.label} voiceover`);
  const cacheDir = path.join(project.paths.cacheDir, "voice");
  const uncached = lines.filter(
    (l) => !existsSync(path.join(cacheDir, `${audio.voiceCacheKey(provider.id, model, voice, l.text)}.json`)),
  );
  const cost = provider.estimateCost(uncached, { model });
  if (uncached.length > 0) {
    const usd = cost.usd === null ? "price unknown for this model" : `≈ $${cost.usd.toFixed(4)}`;
    await confirmCost(
      ctx,
      `${provider.label} ${model} (voice ${voice}): ${uncached.length} of ${lines.length} line(s) to synthesize, ${cost.characters} characters, ${usd}`,
    );
  }
  const result = await audio.buildVoiceover({ provider, voice, model, apiKey, lines, videoDir: video.dir, cacheDir });
  await updateVideoJson(video.videoFile, (raw) => {
    raw.audio ??= {};
    raw.audio.voice = { manifest: "audio/voice.json" };
  });
  const rel = (f: string) => path.relative(ctx.cwd, f);
  const end = Math.max(...result.manifest.lines.map((l) => l.start + l.duration));
  return {
    data: {
      provider: provider.id,
      voice,
      model,
      source,
      cost,
      cached: result.cached,
      manifest: rel(path.join(video.audioDir, "voice.json")),
      lines: result.manifest.lines,
      captions: [rel(result.captions.vtt), rel(result.captions.srt)],
    },
    human: [
      ...result.manifest.lines.map(
        (l) =>
          `${l.id}  ${l.start.toFixed(2)}–${(l.start + l.duration).toFixed(2)} s  ${JSON.stringify(l.text)}${l.estimated ? "  (word timings estimated)" : ""}`,
      ),
      `${result.manifest.lines.length} line(s), ${result.cached} from cache → ${rel(path.join(video.audioDir, "voice.json"))}`,
      ...(end > video.video.duration
        ? [`warn: the voiceover runs to ${end.toFixed(2)} s, past the ${video.video.duration} s video`]
        : []),
      `Next: \`npx demovie audio mix ${video.slug}\``,
    ],
  };
}
