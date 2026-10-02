// Harborly — Every launch, path by path · launch · terminal
// A terminal window types the path of a real screen, then the values that screen shows (copied from the capture);
// the browser window beside it frames and rings the same values. Mono type, grid, shots push up like output.
import { createVideo, logo, screen, text, transition } from "/__demovie/runtime.js";

const v = await createVideo();
const tl = v.timeline;
const vertical = v.height > v.width;
const bar = (n) => v.bar(n);

const add = (parent, markup) => {
  parent.insertAdjacentHTML("beforeend", markup);
  return parent.lastElementChild;
};
const union = (...rects) => {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x, y, width: right - x, height: bottom - y };
};

/**
 * Types a block character by character (a CLI reveal) from `at`, with a block caret that follows the last character,
 * blinks once typing is done and disappears at `until`. Returns the time typing finishes.
 */
function type(el, at, until, cps) {
  text.reveal(el, { at, by: "char", from: "fade", duration: 0.001, stagger: 1 / cps, ease: "none" });
  const chars = [...el.querySelectorAll(".dm-char")];
  const caret = add(el, `<span class="caret"></span>`);
  // Character positions are fixed once fonts are loaded, so the caret path is measured once, here.
  const stops = chars.map((c) => ({ x: c.offsetLeft + c.offsetWidth, y: c.offsetTop }));
  const home = { x: chars[0].offsetLeft, y: chars[0].offsetTop };
  const done = at + chars.length / cps;
  v.onSeek((t) => {
    const typed = Math.max(0, Math.min(chars.length, Math.floor((t - at) * cps) + 1));
    const p = t < at ? home : (stops[typed - 1] ?? home);
    const blink = t >= done && Math.floor((t - done) / 0.5) % 2 === 1;
    caret.style.visibility = t >= at && t < until && !blink ? "inherit" : "hidden";
    caret.style.transform = `translate(${p.x}px, ${p.y}px)`;
  });
  return done;
}

/** A terminal window: a title bar with three dots and a body for typed lines. */
function terminal(parent, lines, extra = "") {
  const pane = add(
    parent,
    `<div class="pane ${extra}"><div class="pane-bar"><span></span><span></span><span></span></div><div class="pane-body">${lines}</div></div>`,
  );
  return [...pane.querySelector(".pane-body").children];
}

// Browser window: right of the terminal (16:9) or above it (9:16).
const screenWidth = vertical ? v.width - v.safe.left - v.safe.right : 920;
const frameHeight = Math.round((screenWidth * 900) / 1440) + Math.max(30, Math.round(screenWidth * 0.034));
const browser = vertical
  ? { width: screenWidth, x: v.safe.left, y: 260 }
  : { width: screenWidth, x: v.width - v.safe.right - screenWidth, y: Math.round((v.height - frameHeight) / 2) };
const maxZoom = 2880 / screenWidth / 1.1;

/** A product shot: the path at a prompt, then a readout, beside the real screen. */
function session(id, from, to, o) {
  const shot = v.shot(id, from, to, { kind: "product" });
  add(shot.el, `<div class="dm-bg"></div>`);
  const app = screen(v, { capture: o.capture, parent: shot.el, device: "browser", ...browser });
  const [prompt, output] = terminal(
    shot.el,
    `<p class="typed prompt">${o.path}</p><p class="typed ${o.comment ? "comment" : ""}">${o.output}</p>`,
  );
  // The output starts a beat after the path has finished typing.
  const outputAt = from + 0.3 + o.path.length / 30 + 0.3;
  type(prompt, from + 0.3, outputAt, 30);
  type(output, outputAt, to, o.cps ?? 34);
  return { shot, app, outputAt };
}

// 1 · Title: a comment, then the tagline typed in large mono
const intro = v.shot("intro", 0, bar(2), { kind: "title" });
add(intro.el, `<div class="dm-bg"></div>`);
const [comment, headline] = terminal(
  intro.el,
  `<p class="typed comment">// Harborly</p><p class="typed headline">Plan, ship and measure every launch.</p>`,
  "pane--hero",
);
type(comment, 0.25, 0.85, 26);
type(headline, 0.85, bar(2), 28);

// 2 · The dashboard: path, then the KPI row's values while the browser frames and rings them
const dashboard = session("dashboard", bar(2), bar(5.5), {
  capture: "routes/app@desktop",
  path: "/app",
  output: `Active projects        9
On track               6
Launches this quarter  5
Avg. velocity          35.5`,
});
const kpis = dashboard.app.rect("dm:dashboard-kpis");
dashboard.app.focus(kpis, {
  at: bar(2) + 0.6,
  duration: 0.7,
  scale: Math.min(maxZoom, (screenWidth * 0.94) / kpis.width),
  ease: "power3.inOut",
});
dashboard.app.highlight("dm:dashboard-kpis", { at: bar(2) + 1.0, duration: 5.4, style: "ring" });

// 3 · A launch plan: path, then the header's values while the camera frames and rings the header
const plan = session("plan", bar(5.5), bar(9), {
  capture: "routes/app-projects-prj_launch@desktop",
  path: "/app/projects/prj_launch",
  output: `Q3 Launch
In progress, On track
68% complete
Due Sep 30, 2026`,
  cps: 32,
});
const header = plan.app.rect("dm:project-header");
plan.app.focus(header, {
  at: bar(5.5) + 0.6,
  duration: 0.7,
  scale: Math.min(maxZoom, (screenWidth * 0.94) / header.width),
  ease: "power3.inOut",
});
plan.app.highlight("dm:project-header", { at: bar(5.5) + 1.2, duration: 5.2, style: "ring" });

// 4 · API keys: path, then the page's own line as a comment; the secret key is masked in the capture
const keys = session("keys", bar(9), bar(12), {
  capture: "routes/app-settings@desktop",
  path: "/app/settings",
  output: "// Use this key to sync launch plans from your own tools.",
  comment: true,
  cps: 36,
});
const apiKeys = union(
  keys.app.rect("heading:api-keys"),
  keys.app.rect("textbox:secret-key"),
  keys.app.rect("button:copy"),
);
keys.app.focus(apiKeys, {
  at: bar(9) + 0.6,
  duration: 0.7,
  scale: Math.min(maxZoom, (screenWidth * 0.9) / apiKeys.width),
  ease: "power3.inOut",
});
keys.app.highlight("textbox:secret-key", { at: bar(9) + 1.4, duration: 4.0, style: "ring" });

// 5 · End card on the ending hit: the wordmark on a light badge, the call to action typed at a prompt
const end = v.shot("end", bar(12), v.duration, { kind: "logo" });
add(end.el, `<div class="dm-bg"></div>`);
const card = add(
  end.el,
  `<div class="end"><div class="badge"></div><p class="dm-cta typed prompt" data-dm-cta>Start free trial</p><p class="url" data-dm-cta>harborly.example</p></div>`,
);
const [badge, cta, url] = card.children;
tl.fromTo(badge, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, bar(12));
logo(v, { at: bar(12) + 0.1, variant: "wordmark", parent: badge });
tl.fromTo(cta, { opacity: 0 }, { opacity: 1, duration: 0.2 }, bar(12) + 0.45);
type(cta, bar(12) + 0.6, v.duration, 24);
tl.fromTo(url, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out" }, bar(12) + 1.4);

// Output scrolls: each shot pushes the previous one up, on the beat
const scroll = { duration: 0.5, direction: "up" };
transition.push(intro, dashboard.shot, { at: bar(2) - 0.25, ...scroll });
transition.push(dashboard.shot, plan.shot, { at: bar(5.5) - 0.25, ...scroll });
transition.push(plan.shot, keys.shot, { at: bar(9) - 0.25, ...scroll });
transition.push(keys.shot, end, { at: bar(12) - 0.25, ...scroll });

v.ready();
