/** The example videos on the site: what each one is, where its source lives, and its web copies in site/media. */
import path from "node:path";
import { readBrief, readStoryboard, readVideo, type Shot, type VideoInfo } from "./data.ts";

export interface SiteVideo extends VideoInfo {
  /** Media id prefix: site/media/video/<id>-<16x9|9x16|1x1>.mp4 */
  id: string;
  group: "harborly" | "styles";
  name: string;
  blurb: string;
  /** How it was made, in one sentence. */
  made: string;
  /** Repo path of the video folder. */
  source: string;
  brief: Record<string, string>;
  shots: Shot[];
}

const tag = (format: string) => format.replace(":", "x");

export function videoSrc(v: SiteVideo, format: string, root: string): string {
  return `${root}media/video/${v.id}-${tag(format)}.mp4`;
}

export function posterSrc(v: SiteVideo, format: string, root: string): string {
  return `${root}media/posters/${v.id}-${tag(format)}.webp`;
}

export function readVideos(repoRoot: string): SiteVideo[] {
  const harborly = (id: string, slug: string, name: string, blurb: string, made: string): SiteVideo => {
    const source = `examples/harborly/.demovie/videos/${slug}`;
    const dir = path.join(repoRoot, source);
    return {
      ...readVideo(dir),
      id,
      group: "harborly",
      name,
      blurb,
      made,
      source,
      brief: readBrief(dir),
      shots: readStoryboard(dir),
    };
  };
  const style = (name: string, blurb: string): SiteVideo => {
    const source = `examples/compositions/${name}-launch`;
    const dir = path.join(repoRoot, source);
    return {
      ...readVideo(dir),
      id: `style-${name}`,
      group: "styles",
      name: `\`${name}\``,
      blurb,
      made: `The reference composition for the ${name} style preset, made from captures of Harborly. It passes QA.`,
      source,
      brief: readBrief(dir),
      shots: readStoryboard(dir),
    };
  };
  return [
    harborly(
      "harborly-launch",
      "launch",
      "Launch video",
      "The Projects board, from Planning to Launched, and a new launch plan made through the real dialog.",
      "Made by following the demovie skill on Harborly, the same way your agent would.",
    ),
    harborly(
      "harborly-changelog",
      "changelog",
      "Changelog clip",
      "One release note, shown on the screens it changed: health badges now carry an icon.",
      "Made in changelog mode: `demovie changes` traced the commit through the import graph to the routes it touched.",
    ),
    harborly(
      "harborly-teaser",
      "projects-board-teaser",
      "Teaser",
      "Twelve seconds on the Projects board, with a ring on a real At risk badge.",
      "From one command, `npx demovie make --type teaser --format 16:9 --yes`, in a project that was already set up: 3 min 21 s and $1.06 of agent time (Claude Opus 5.5, as reported by Claude Code), QA 0 errors and 0 warnings.",
    ),
    style("clean", "Neutral background, one accent, the product UI as the hero."),
    style("bold", "Kinetic type at 10–16% of the frame height, hard cuts on the beat."),
    style("soft", "Rounded shapes, tints of the brand color, floating captures."),
    style("editorial", "Large display type, generous whitespace, slow camera drift."),
    style("terminal", "Mono type on a grid, typed reveals, a dev-tool feel."),
  ];
}
