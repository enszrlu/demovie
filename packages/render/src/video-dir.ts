import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { DemovieError, type FormatId, type Project, readJson, type Video, VideoSchema } from "@demovie/core";

export interface VideoContext {
  slug: string;
  /** The video folder (holds video.json, composition/, audio/, out/). */
  dir: string;
  videoFile: string;
  compositionDir: string;
  audioDir: string;
  outDir: string;
  video: Video;
}

/** `slug` → `.demovie/videos/<slug>`; a path to a folder with video.json is used as-is (DECISIONS D30). */
export async function resolveVideo(
  project: Pick<Project, "paths">,
  slugOrPath: string,
  cwd = process.cwd(),
): Promise<VideoContext> {
  const asPath = path.resolve(cwd, slugOrPath);
  const looksLikePath = /[\\/]/.test(slugOrPath) || slugOrPath.startsWith(".");
  let dir: string;
  if (looksLikePath && existsSync(path.join(asPath, "video.json"))) dir = asPath;
  else if (!looksLikePath) dir = path.join(project.paths.videosDir, slugOrPath);
  else {
    throw new DemovieError(
      "E_NOT_FOUND",
      `no video.json in ${slugOrPath}`,
      "pass a video slug, or a folder containing video.json",
    );
  }
  const videoFile = path.join(dir, "video.json");
  if (!existsSync(videoFile)) {
    throw new DemovieError(
      "E_NOT_FOUND",
      `video "${slugOrPath}" not found (${path.relative(cwd, videoFile) || videoFile})`,
      `create it with \`npx demovie new ${slugOrPath} --type launch\``,
    );
  }
  const video = await readJson(videoFile, VideoSchema, `fix ${videoFile} (see schema/video.schema.json)`);
  const compositionDir = path.join(dir, "composition");
  if (!existsSync(path.join(compositionDir, "index.html")) || !statSync(compositionDir).isDirectory()) {
    throw new DemovieError(
      "E_NOT_FOUND",
      `${path.relative(cwd, compositionDir)}/index.html is missing`,
      `re-create the scaffold with \`npx demovie new ${video.slug} --type ${video.type} --force\``,
    );
  }
  return {
    slug: video.slug,
    dir,
    videoFile,
    compositionDir,
    audioDir: path.join(dir, "audio"),
    outDir: path.join(dir, "out"),
    video,
  };
}

/** Formats to process: `all` → every format in video.json. */
export function selectFormats(video: Video, format: string | undefined): FormatId[] {
  if (!format || format === "all") return video.formats;
  const list = format.split(",").map((f) => f.trim()) as FormatId[];
  for (const f of list) {
    if (!video.formats.includes(f)) {
      throw new DemovieError(
        "E_USAGE",
        `format ${f} is not in video.json formats (${video.formats.join(", ")})`,
        `add "${f}" to "formats" in video.json, or pass --format ${video.formats[0]}`,
      );
    }
  }
  return list;
}
