import { existsSync } from "node:fs";
import type { ServerResponse } from "node:http";
import path from "node:path";
import { FORMATS, type Project } from "@demovie/core";
import { watch } from "chokidar";
import { type StaticServer, startServer } from "./server.ts";
import type { VideoContext } from "./video-dir.ts";

export interface PreviewServer extends StaticServer {
  url: string;
  /** Number of reload events sent (tests). */
  reloads: () => number;
}

function playerHtml(video: VideoContext): string {
  const formats = video.video.formats;
  const sizes = Object.fromEntries(formats.map((f) => [f, FORMATS[f]]));
  return `<!doctype html><html><head><meta charset="utf-8"><title>${video.video.title} · demovie preview</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;height:100vh;display:grid;grid-template-rows:1fr auto;background:#0b0b0d;color:#e4e4e7;font:13px/1.4 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
#viewport{position:relative;overflow:hidden;display:grid;place-items:center}
#holder{position:relative;transform-origin:center center;box-shadow:0 0 0 1px #27272a,0 30px 80px rgba(0,0,0,.5)}
#holder iframe{display:block;border:0;background:#fff}
.overlay{position:absolute;inset:0;pointer-events:none}
#safe{border:2px dashed rgba(250,204,21,.9)}
#grid{background-image:linear-gradient(rgba(255,255,255,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.18) 1px,transparent 1px)}
.qa{position:absolute;border:2px solid #f43f5e;background:rgba(244,63,94,.08)}
.qa span{position:absolute;left:-2px;top:-22px;background:#f43f5e;color:#fff;font:600 12px/1 ui-sans-serif,system-ui;padding:4px 6px;border-radius:3px;white-space:nowrap}
.qa.warn{border-color:#f59e0b;background:rgba(245,158,11,.08)}.qa.warn span{background:#f59e0b}
#bar{display:grid;grid-template-columns:auto auto 1fr auto auto;gap:12px;align-items:center;padding:10px 16px;background:#111114;border-top:1px solid #27272a}
button,select{background:#1f1f23;color:#fafafa;border:1px solid #3f3f46;border-radius:6px;padding:6px 10px;font:inherit;cursor:pointer}
#time{font-variant-numeric:tabular-nums;min-width:140px}
#scrub{position:relative;height:28px}
#scrub input{position:absolute;inset:0;width:100%;margin:0;accent-color:#2563eb}
#markers{position:absolute;left:0;right:0;top:0;height:6px;pointer-events:none}
#markers i{position:absolute;top:0;width:2px;height:6px;background:#a1a1aa}
label{display:inline-flex;gap:4px;align-items:center;color:#a1a1aa}
#status{color:#a1a1aa;max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#status.err{color:#fb7185}
</style></head><body>
<div id="viewport"><div id="holder"><iframe id="frame"></iframe><div id="grid" class="overlay" hidden></div><div id="safe" class="overlay" hidden></div><div id="qa" class="overlay"></div></div></div>
<div id="bar">
  <div><button id="play" title="space">▶</button> <button id="prev" title="←">‹</button> <button id="next" title="→">›</button></div>
  <div id="time">0.00 / 0.00 s</div>
  <div id="scrub"><div id="markers"></div><input id="range" type="range" min="0" step="0.001" value="0"></div>
  <div><select id="format">${formats.map((f) => `<option>${f}</option>`).join("")}</select>
  <label><input type="checkbox" id="tSafe"> safe</label> <label><input type="checkbox" id="tGrid"> grid</label> <label><input type="checkbox" id="tQa" checked> QA</label></div>
  <div id="status">loading…</div>
</div>
<audio id="audio" preload="auto"></audio>
<script>
const SIZES = ${JSON.stringify(sizes)};
const fps = ${video.video.fps};
let format = new URLSearchParams(location.search).get("format") || ${JSON.stringify(formats[0])};
let t = Number(new URLSearchParams(location.search).get("t") || 0);
let duration = ${video.video.duration};
let playing = false, startWall = 0, startT = 0, busy = false, qa = null;
const $ = (id) => document.getElementById(id);
const frame = $("frame"), holder = $("holder"), audio = $("audio"), range = $("range");
$("format").value = format;
fetch("/audio/mix.wav", { method: "HEAD" }).then((r) => { if (r.ok) audio.src = "/audio/mix.wav"; });
function fit() {
  const s = SIZES[format]; frame.width = s.width; frame.height = s.height;
  holder.style.width = s.width + "px"; holder.style.height = s.height + "px";
  const vp = $("viewport").getBoundingClientRect();
  holder.style.transform = "scale(" + Math.min((vp.width - 40) / s.width, (vp.height - 40) / s.height) + ")";
  const safe = $("safe").style; safe.left = s.safe.left + "%"; safe.right = s.safe.right + "%"; safe.top = s.safe.top + "%"; safe.bottom = s.safe.bottom + "%";
  const g = $("grid").style; g.backgroundSize = (s.width / 12) + "px " + (s.height / 12) + "px";
}
function api() { return frame.contentWindow && frame.contentWindow.__DEMOVIE__; }
function load() {
  fit(); $("status").textContent = "loading…"; $("status").className = "";
  frame.src = "/?format=" + encodeURIComponent(format) + "&scale=1&v=" + Date.now();
}
frame.addEventListener("load", () => {
  const started = Date.now();
  const wait = () => {
    const h = api();
    if (h && h.error) { $("status").textContent = h.error; $("status").className = "err"; return; }
    if (h && h.ready) { duration = h.meta.duration; range.max = duration; markers(); go(t); $("status").textContent = "ready"; return; }
    if (Date.now() - started > 60000) { $("status").textContent = "v.ready() was never called"; $("status").className = "err"; return; }
    setTimeout(wait, 50);
  };
  wait();
});
function markers() {
  const el = $("markers"); el.innerHTML = "";
  for (const s of api().inspect().shots) { const i = document.createElement("i"); i.style.left = (100 * s.start / duration) + "%"; i.title = s.id; el.appendChild(i); }
}
async function go(next) {
  t = Math.max(0, Math.min(duration, next));
  range.value = t;
  $("time").textContent = t.toFixed(2) + " / " + duration.toFixed(2) + " s · f" + Math.round(t * fps);
  const h = api(); if (!h || !h.ready || busy) return;
  busy = true; try { await h.seek(t); } finally { busy = false; }
  drawQa();
}
function drawQa() {
  const box = $("qa"); box.innerHTML = "";
  if (!$("tQa").checked || !qa) return;
  const rep = (qa.reports || []).find((r) => r.format === format); if (!rep) return;
  for (const rule of rep.rules) {
    if (rule.status !== "fail") continue;
    for (const o of rule.occurrences) {
      if (Math.abs(o.t - t) > 0.051 || !o.bbox) continue;
      const d = document.createElement("div"); d.className = "qa" + (rule.severity === "warn" ? " warn" : "");
      Object.assign(d.style, { left: o.bbox.x + "px", top: o.bbox.y + "px", width: o.bbox.width + "px", height: o.bbox.height + "px" });
      const s = document.createElement("span"); s.textContent = rule.id + " · " + o.detail; d.appendChild(s); box.appendChild(d);
    }
  }
}
function loop() {
  if (!playing) return;
  const now = audio.src && !audio.paused ? audio.currentTime : startT + (performance.now() - startWall) / 1000;
  if (now >= duration) { toggle(); go(duration); return; }
  if (!busy) go(now);
  requestAnimationFrame(loop);
}
function toggle() {
  playing = !playing; $("play").textContent = playing ? "❚❚" : "▶";
  if (playing) { if (t >= duration - 1 / fps) t = 0; startWall = performance.now(); startT = t; if (audio.src) { audio.currentTime = t; audio.play().catch(() => {}); } requestAnimationFrame(loop); }
  else if (audio.src) audio.pause();
}
$("play").onclick = toggle;
$("prev").onclick = () => go(Math.round(t * fps - 1) / fps);
$("next").onclick = () => go(Math.round(t * fps + 1) / fps);
range.oninput = () => { if (playing) toggle(); go(Number(range.value)); };
$("format").onchange = (e) => { format = e.target.value; load(); };
$("tSafe").onchange = (e) => { $("safe").hidden = !e.target.checked; };
$("tGrid").onchange = (e) => { $("grid").hidden = !e.target.checked; };
$("tQa").onchange = drawQa;
addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); toggle(); } if (e.key === "ArrowLeft") $("prev").onclick(); if (e.key === "ArrowRight") $("next").onclick(); });
addEventListener("resize", fit);
fetch("/__preview/qa.json").then((r) => (r.ok ? r.json() : null)).then((j) => { qa = j; drawQa(); }).catch(() => {});
const events = new EventSource("/__preview/events");
events.addEventListener("reload", () => { fetch("/__preview/qa.json").then((r) => (r.ok ? r.json() : null)).then((j) => { qa = j; }); load(); });
load();
</script></body></html>`;
}

/** `demovie preview`: player page + composition, hot reload over SSE (SPEC §11.7). Binds 127.0.0.1. */
export async function startPreview(
  project: Project,
  video: VideoContext,
  o: { port?: number } = {},
): Promise<PreviewServer> {
  const clients = new Set<ServerResponse>();
  let reloads = 0;
  const server = await startServer({
    project,
    video,
    ...(o.port !== undefined ? { port: o.port } : {}),
    extra: (req, res, url) => {
      if (url.pathname === "/__preview/" || url.pathname === "/__preview") {
        res
          .writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" })
          .end(playerHtml(video));
        return true;
      }
      if (url.pathname === "/__preview/events") {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-store",
          connection: "keep-alive",
        });
        res.write(": connected\n\n");
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return true;
      }
      if (url.pathname === "/__preview/qa.json") {
        const file = path.join(video.dir, "qa.json");
        if (!existsSync(file)) {
          res.writeHead(404).end();
          return true;
        }
        res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
        import("node:fs").then((fs) => fs.createReadStream(file).pipe(res));
        return true;
      }
      return false;
    },
  });
  const watcher = watch(
    [
      video.compositionDir,
      video.videoFile,
      video.audioDir,
      project.paths.capturesDir,
      project.paths.brandDir,
      path.join(video.dir, "qa.json"),
    ],
    {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 },
    },
  );
  let timer: NodeJS.Timeout | null = null;
  watcher.on("all", () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      reloads++;
      for (const client of clients) client.write("event: reload\ndata: {}\n\n");
    }, 150);
  });
  await new Promise<void>((resolve) => watcher.once("ready", () => resolve()));
  return {
    ...server,
    url: `${server.origin}/__preview/`,
    reloads: () => reloads,
    close: async () => {
      for (const client of clients) client.end();
      clients.clear();
      await watcher.close();
      await server.close();
    },
  };
}
