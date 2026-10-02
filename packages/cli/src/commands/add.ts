import { existsSync, statSync } from "node:fs";
import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import {
  type Asset,
  AssetsSchema,
  DemovieError,
  ensureDir,
  loadProject,
  type Provenance,
  ProvenanceSchema,
  slugify,
  writeJson,
} from "@demovie/core";
import type { CommandContext } from "../context.ts";
import type { CommandResult } from "../output.ts";

const KINDS: [Asset["kind"], RegExp][] = [
  ["image", /\.(png|jpe?g|webp|gif|svg|avif)$/i],
  ["video", /\.(mp4|mov|m4v|webm|mkv|avi)$/i],
  ["audio", /\.(wav|mp3|m4a|aac|ogg|flac|opus)$/i],
  ["font", /\.(woff2?|ttf|otf)$/i],
  ["script", /\.(md|mdx|txt|json|csv|ya?ml)$/i],
];

function kindOf(file: string): Asset["kind"] {
  return KINDS.find(([, re]) => re.test(file))?.[0] ?? "other";
}

/** `demovie add <files…> [--describe] [--licensed]` (SPEC §7): import resources into .demovie/assets. */
export async function run(
  ctx: CommandContext,
  files: string[],
  options: { describe?: string; licensed?: boolean },
): Promise<CommandResult> {
  const project = await loadProject(ctx.cwd);
  const { paths } = project;
  await ensureDir(paths.assetsDir);
  const assets = existsSync(paths.assetsJson)
    ? AssetsSchema.parse(JSON.parse(await readFile(paths.assetsJson, "utf8")))
    : { assets: [] as Asset[] };
  const provenanceFile = path.join(paths.assetsDir, "provenance.json");
  const provenance: Provenance = existsSync(provenanceFile)
    ? ProvenanceSchema.parse(JSON.parse(await readFile(provenanceFile, "utf8")))
    : { files: [] };
  const added: Asset[] = [];
  const { encodeWebm, ffmpegBin, probe } = await import("@demovie/render");

  // Check every input before importing any, so a refused file never leaves the others half imported.
  for (const input of files) {
    const source = path.resolve(ctx.cwd, input);
    if (!existsSync(source)) throw new DemovieError("E_NOT_FOUND", `${input} does not exist`, "check the path");
    if (!statSync(source).isFile())
      throw new DemovieError("E_USAGE", `${input} is not a file`, "pass image, video or audio files (not folders)");
    if (kindOf(source) === "audio" && !options.licensed) {
      throw new DemovieError(
        "E_USAGE",
        `${input} is audio; demovie only imports audio you hold a license for`,
        `re-run with --licensed if you have the rights (e.g. \`npx demovie add ${input} --licensed --describe "Track from <library>, license #…"\`)`,
      );
    }
  }

  for (const input of files) {
    const source = path.resolve(ctx.cwd, input);
    const kind = kindOf(source);
    const ext = kind === "video" ? ".webm" : path.extname(source).toLowerCase();
    const base = slugify(path.basename(source, path.extname(source)));
    let name = `${base}${ext}`;
    for (let i = 2; existsSync(path.join(paths.assetsDir, name)); i++) name = `${base}-${i}${ext}`;
    const dest = path.join(paths.assetsDir, name);
    const asset: Asset = {
      file: name,
      description: options.describe ?? null,
      kind,
      original: path.basename(source),
      addedAt: new Date().toISOString(),
    };
    if (kind === "video") {
      ffmpegBin();
      // Chromium (as bundled with Playwright) has no H.264 decoder: compositions get VP9 WebM.
      await encodeWebm(source, dest);
    } else {
      await copyFile(source, dest);
    }
    if (kind === "video" || kind === "image" || kind === "audio") {
      const info = await probe(dest).catch(() => null);
      if (info?.width) {
        asset.width = info.width;
        asset.height = info.height;
      }
      if (info?.duration && kind !== "image") asset.duration = Math.round(info.duration * 1000) / 1000;
    }
    if (kind === "audio") {
      asset.licensed = true;
      provenance.files = provenance.files.filter((f) => f.file !== name);
      provenance.files.push({
        file: name,
        kind: "import",
        generator: "user-licensed",
        license: options.describe ?? "licensed by the user (demovie add --licensed)",
        createdAt: asset.addedAt,
        details: { original: path.basename(source) },
      });
    }
    assets.assets = assets.assets.filter((a) => a.file !== name);
    assets.assets.push(asset);
    added.push(asset);
  }
  await writeJson(paths.assetsJson, assets);
  if (provenance.files.length > 0) await writeJson(provenanceFile, provenance);
  return {
    data: { added, assetsJson: path.relative(ctx.cwd, paths.assetsJson) },
    human: added.map(
      (a) =>
        `added .demovie/assets/${a.file} (${a.kind}${a.width ? `, ${a.width}×${a.height}` : ""}${a.duration ? `, ${a.duration}s` : ""})`,
    ),
  };
}
