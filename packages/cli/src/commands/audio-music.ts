import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DemovieError, loadProject, readStoryboard, sha256 } from "@demovie/core";
import type { CommandContext } from "../context.ts";
import {
  confirmCost,
  isLicensedAsset,
  requireKey,
  resolveAudioSrc,
  updateVideoJson,
  writeIfChanged,
  writeJsonIfChanged,
} from "../lib/audio.ts";
import type { CommandResult } from "../output.ts";

export interface MusicCliOptions {
  bpm?: number;
  mood?: string;
  provider?: "synth" | "elevenlabs" | "file";
  seed?: string;
  key?: string;
}

/** `demovie audio music <slug>` (SPEC §13.1): music + beats.json + provenance, wired into video.json. */
export async function run(ctx: CommandContext, slug: string, options: MusicCliOptions): Promise<CommandResult> {
  const project = await loadProject(ctx.cwd);
  const { resolveVideo } = await import("@demovie/render");
  const audio = await import("@demovie/audio");
  const video = await resolveVideo(project, slug, ctx.cwd);
  const provider = options.provider ?? project.config.audio.music.provider;
  if (provider === "none") {
    throw new DemovieError(
      "E_USAGE",
      'music is off for this project (audio.music.provider is "none")',
      `pass --provider synth, or set audio.music.provider in .demovie/config.json`,
    );
  }
  if (video.video.type === "hero-loop" && !options.provider) {
    throw new DemovieError(
      "E_USAGE",
      "hero-loop videos are muted by default (SPEC §11.3)",
      `pass --provider synth to add music anyway: \`npx demovie audio music ${video.slug} --provider synth\``,
    );
  }
  const mood = (options.mood ?? audio.moodForStyle(video.video.style)) as (typeof audio.MOODS)[number];
  if (!audio.MOODS.includes(mood))
    throw new DemovieError("E_USAGE", `unknown mood "${mood}"`, `pass --mood ${audio.MOODS.join("|")}`);
  const sbFile = path.join(video.dir, "storyboard.md");
  const storyboard = existsSync(sbFile) ? await readStoryboard(sbFile) : null;
  const bpm = options.bpm ?? storyboard?.bpm ?? audio.MOOD_BPM[mood];
  if (!(bpm >= 80 && bpm <= 140))
    throw new DemovieError("E_USAGE", `--bpm ${bpm} is outside 80–140`, "pass --bpm between 80 and 140");
  if (options.key && !audio.parseKey(options.key))
    throw new DemovieError(
      "E_USAGE",
      `unknown key "${options.key}"`,
      'pass e.g. --key C, --key "F#m" or --key "Eb major"',
    );
  const duration = video.video.duration;
  const sections = storyboard?.rows.length
    ? audio.sectionsFromStoryboard(storyboard.rows, duration, bpm)
    : audio.defaultSections(duration, bpm);
  const beatsFile = path.join(video.audioDir, "beats.json");
  const rel = (f: string) => path.relative(ctx.cwd, f);
  const started = Date.now();

  if (provider === "synth") {
    const seed = options.seed ?? video.slug;
    const result = audio.synthMusic({ bpm, mood, duration, seed, key: options.key ?? null, sections });
    const wav = audio.encodeWav(result.audio);
    const file = path.join(video.audioDir, "music.wav");
    await writeIfChanged(file, wav);
    await writeJsonIfChanged(beatsFile, result.beats);
    await audio.recordProvenance(video.audioDir, [
      {
        file: "music.wav",
        kind: "music",
        generator: "demovie-synth",
        license: "CC0-1.0",
        details: { mood, bpm, key: result.key, seed, duration, endHit: result.endHit, sha256: sha256(wav) },
      },
    ]);
    await updateVideoJson(video.videoFile, (raw) => {
      raw.audio ??= {};
      raw.audio.music = { src: "audio/music.wav", gain: raw.audio.music?.gain ?? -14, beats: "audio/beats.json" };
    });
    return {
      data: {
        provider,
        file: rel(file),
        beats: rel(beatsFile),
        mood,
        bpm,
        key: result.key,
        seed,
        duration,
        sections: result.sections,
        endHit: result.endHit,
        ms: Date.now() - started,
      },
      human: [
        `${rel(file)} · ${mood} · ${bpm} BPM · ${result.key} · seed "${seed}" · ${duration} s`,
        `${rel(beatsFile)} · sections ${result.sections.map((s) => `${s.name} ${s.start}–${s.end}`).join(", ")}${result.endHit !== null ? ` · ending hit ${result.endHit} s` : ""}`,
        `Next: \`npx demovie audio mix ${video.slug}\``,
      ],
    };
  }

  let file: string;
  if (provider === "elevenlabs") {
    const apiKey = requireKey(project, "ELEVENLABS_API_KEY", "ElevenLabs music");
    const cost = audio.elevenLabsMusicCost(duration);
    await confirmCost(ctx, `ElevenLabs Music: ${duration} s of music ≈ $${cost.usd.toFixed(2)} (your account)`);
    const endHit = sections.find((s) => s.name === "outro")?.start ?? null;
    const prompt = audio.musicPrompt({ mood, bpm, key: options.key ?? null, duration, sections, endHit });
    file = path.join(video.audioDir, "music.mp3");
    await audio.generateElevenLabsMusic({ prompt, duration, apiKey, outFile: file });
    await audio.recordProvenance(video.audioDir, [
      {
        file: "music.mp3",
        kind: "music",
        generator: "elevenlabs",
        license: "ElevenLabs output under your account's terms",
        details: { prompt, mood, bpm, duration, sha256: sha256(await readFile(file)) },
      },
    ]);
    await updateVideoJson(video.videoFile, (raw) => {
      raw.audio ??= {};
      raw.audio.music = { src: "audio/music.mp3", gain: raw.audio.music?.gain ?? -14, beats: "audio/beats.json" };
    });
  } else {
    const src = video.video.audio.music?.src;
    if (!src)
      throw new DemovieError(
        "E_USAGE",
        "no music file in video.json (audio.music.src)",
        'import your track with `npx demovie add <file> --licensed`, then set audio.music.src to "assets/<file>"',
      );
    file = resolveAudioSrc(project, video.dir, src);
    if (!existsSync(file))
      throw new DemovieError("E_NOT_FOUND", `${src} does not exist`, "fix audio.music.src in video.json");
    if (src.replace(/^\/+/, "").startsWith("assets/") && !isLicensedAsset(project, file))
      throw new DemovieError(
        "E_USAGE",
        `${src} was not imported with --licensed`,
        `re-import it: \`npx demovie add <file> --licensed --describe "<license>"\``,
      );
    await updateVideoJson(video.videoFile, (raw) => {
      raw.audio.music.beats = "audio/beats.json";
    });
  }
  // provider/file music: the beat grid comes from the requested BPM plus onset detection
  const pcm = await audio.decodeAudio(file);
  const offset = audio.detectBeatOffset(pcm, bpm);
  const beats = audio.beatGrid(bpm, offset, duration, sections);
  await writeJsonIfChanged(beatsFile, beats);
  return {
    data: {
      provider,
      file: rel(file),
      beats: rel(beatsFile),
      mood,
      bpm,
      offset,
      duration,
      sections,
      ms: Date.now() - started,
    },
    human: [
      `${rel(file)} · ${provider} · ${bpm} BPM (first beat at ${offset} s, onset detection)`,
      `${rel(beatsFile)}`,
      `Next: \`npx demovie audio mix ${video.slug}\``,
    ],
  };
}
