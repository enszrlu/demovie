import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { FORMATS, type FormatId, formatSlug, type Project, toPosix } from "@demovie/core";
import { startServer } from "./server.ts";
import { capture, launchRenderer, openComposition, seek } from "./session.ts";
import type { VideoContext } from "./video-dir.ts";

export interface Still {
  format: FormatId;
  t: number;
  file: string;
  shots: string[];
}

export interface StillsReport {
  stills: Still[];
  sheets: { format: FormatId; file: string }[];
  ms: number;
}

/** Times for `--every <sec>`: 0, s, 2s, … up to the last frame. */
export function everyTimes(duration: number, every: number, fps: number): number[] {
  const last = (Math.round(duration * fps) - 1) / fps;
  const out: number[] = [];
  for (let t = 0; t <= last + 1e-9; t += every) out.push(Math.round(t * 1000) / 1000);
  return out;
}

function label(t: number): string {
  return `t${t.toFixed(2).padStart(6, "0")}`;
}

function sheetHtml(format: FormatId, items: { src: string; t: number; shots: string[] }[]): string {
  const f = FORMATS[format];
  const cols = f.width >= f.height ? 4 : 6;
  const cellW = f.width >= f.height ? 380 : 250;
  const cellH = Math.round((cellW * f.height) / f.width);
  const safe = f.safe;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;padding:24px;background:#0b0b0d;color:#e4e4e7;font:12px/1.3 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
  h1{margin:0 0 16px;font-size:15px;font-weight:600;color:#fafafa}
  .grid{display:grid;grid-template-columns:repeat(${cols},${cellW}px);gap:14px}
  .cell{display:flex;flex-direction:column;gap:6px}
  .frame{position:relative;width:${cellW}px;height:${cellH}px;background:#18181b;border-radius:4px;overflow:hidden}
  .frame img{width:100%;height:100%;display:block}
  .safe{position:absolute;left:${safe.left}%;right:${safe.right}%;top:${safe.top}%;bottom:${safe.bottom}%;border:1px dashed rgba(250,204,21,.85)}
  .meta{display:flex;justify-content:space-between;gap:8px}
  .t{font-variant-numeric:tabular-nums;color:#fafafa;font-weight:600}
  .shot{color:#a1a1aa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  </style></head><body><h1>Contact sheet · ${format} · ${items.length} stills · dashed = safe area</h1><div class="grid">
  ${items.map((i) => `<div class="cell"><div class="frame"><img src="${i.src}"><div class="safe"></div></div><div class="meta"><span class="t">${i.t.toFixed(2)}s</span><span class="shot">${i.shots.join(", ") || "—"}</span></div></div>`).join("\n")}
  </div></body></html>`;
}

/** Still frames per format (scale 0.5 default) plus an optional contact sheet (SPEC §11.6). */
export async function renderStills(
  project: Project,
  video: VideoContext,
  o: { formats: FormatId[]; times: number[]; scale?: number; sheet?: boolean },
): Promise<StillsReport> {
  const started = Date.now();
  const scale = o.scale ?? 0.5;
  const report: StillsReport = { stills: [], sheets: [], ms: 0 };
  const server = await startServer({ project, video });
  const browser = await launchRenderer();
  try {
    for (const format of o.formats) {
      const dir = path.join(video.outDir, "stills", formatSlug(format));
      await mkdir(dir, { recursive: true });
      const comp = await openComposition(browser, server, { format, scale });
      const items: { src: string; t: number; shots: string[] }[] = [];
      for (const t of o.times) {
        await seek(comp.page, t);
        const file = path.join(dir, `${label(t)}.png`);
        await writeFile(file, await capture(comp, "png"));
        const shots = (await comp.page.evaluate(
          "window.__DEMOVIE__.inspect().shots.filter((s) => s.active).map((s) => s.id)",
        )) as string[];
        report.stills.push({ format, t, file, shots });
        items.push({ src: `/__out/${toPosix(path.relative(video.outDir, file))}`, t, shots });
      }
      await comp.close();
      if (o.sheet) {
        const html = path.join(dir, "sheet.html");
        await writeFile(html, sheetHtml(format, items));
        const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
        const page = await context.newPage();
        await page.goto(`${server.origin}/__out/${toPosix(path.relative(video.outDir, html))}`, { waitUntil: "load" });
        await page.evaluate("Promise.all([...document.images].map((i) => i.decode().catch(() => {})))");
        const width = (await page.evaluate("document.documentElement.scrollWidth")) as number;
        await page.setViewportSize({ width, height: 800 });
        const sheet = path.join(dir, "sheet.png");
        await page.screenshot({ path: sheet, fullPage: true });
        await context.close();
        report.sheets.push({ format, file: sheet });
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
  report.ms = Date.now() - started;
  return report;
}
