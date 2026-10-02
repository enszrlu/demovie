// Harborly — the Projects board · teaser · clean
// Every product pixel is routes/app-projects@desktop; every camera and highlight target is an element id from its
// element map. Cuts land on bar lines of the music (120 BPM: one bar = 2 s), the end card on the ending hit.
import { createVideo, logo, screen, text, transition } from "/__demovie/runtime.js";

const v = await createVideo();
const tl = v.timeline;
const u = v.unit;
const bar = (n) => v.bar(n);
const beat = (n) => v.beat(n);
const EASE = "expo.out";

const add = (parent, markup) => {
  parent.insertAdjacentHTML("beforeend", markup);
  return parent.lastElementChild;
};

// Layout: a headline above a browser frame
const frameWidth = 1280;
const screenTop = 196;
// Desktop captures are 2880 px wide (1440 CSS px @2x): never zoom past their native density (QA DM-G05).
const maxZoom = 2880 / frameWidth;
const zoomFor = (rect, fill = 0.86) =>
  Math.min(maxZoom * 0.95, (frameWidth * fill) / rect.width, ((frameWidth * 900) / 1440) * (fill / rect.height));

function headline(shot, copy, at, out) {
  const h = add(shot.el, `<h2 class="dm-title headline">${copy}</h2>`);
  text.reveal(h, { at, by: "word", stagger: 0.06, duration: 0.8, ease: EASE });
  tl.to(h, { opacity: 0, y: -1.5 * u, duration: 0.35, ease: "power2.in" }, out);
  return h;
}

// 1 · Hook: "Every launch." then "One board.", each phrase on its own beat with its own motion
// The hook holds half a bar past bar 1 so "One board." can be read
const HOOK_END = bar(1) + 0.5;
const intro = v.shot("intro", 0, HOOK_END, { kind: "title" });
add(intro.el, `<div class="dm-bg"></div>`);
const hook = add(
  intro.el,
  `<div class="hook"><h1 class="dm-title hook-a">Every launch.</h1><h1 class="dm-title hook-b">One board.</h1></div>`,
);
const hookA = hook.querySelector(".hook-a");
const hookB = hook.querySelector(".hook-b");
text.reveal(hookA, { at: 0, by: "word", stagger: 0.08, duration: 0.7, ease: EASE });
tl.fromTo(hookA, { letterSpacing: "0.06em" }, { letterSpacing: "-0.03em", duration: 1.1, ease: EASE }, 0);
text.reveal(hookB, { at: beat(1), by: "word", stagger: 0.08, duration: 0.6, ease: EASE });
tl.fromTo(hookB, { scale: 1.12 }, { scale: 1, duration: 0.7, ease: EASE }, beat(1));
tl.to(hook, { scale: 0.94, opacity: 0, duration: 0.35, ease: "power2.in" }, HOOK_END - 0.35);

// 2 · The real board: sweep Planning → Launched, then health at a glance
const board = v.shot("board", HOOK_END, bar(5), { kind: "product" });
add(board.el, `<div class="dm-bg"></div>`);
const app = screen(v, {
  capture: "routes/app-projects@desktop",
  parent: board.el,
  device: "browser",
  width: frameWidth,
  x: (v.width - frameWidth) / 2,
  y: screenTop,
});
tl.fromTo(app.el, { y: 10 * u, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: EASE }, HOOK_END - 0.2);

headline(board, "From Planning to Launched.", HOOK_END + 0.2, bar(3) - 0.35);
const planning = app.rect("heading:planning", "link:eu-data-residency");
const launched = app.rect("heading:launched", "link:spring-launch");
app.focus(planning, { at: HOOK_END + 0.4, duration: 0.9, scale: zoomFor(planning, 0.8), ease: "power3.inOut" });
app.focus(launched, { at: bar(2) + 0.2, duration: 1.2, scale: zoomFor(launched, 0.8), ease: "power3.inOut" });

headline(board, "Health at a glance.", bar(3) + 0.1, bar(5) - 0.4);
const health = app.rect("link:android-app-v2", "link:billing-migration");
app.focus(health, { at: bar(3), duration: 1.0, scale: zoomFor(health, 0.78), ease: "power3.inOut" });
app.highlight("dm:health-prj_android-app-v2", { at: bar(3) + 1.0, duration: 1.2, style: "ring" });
app.highlight("dm:health-prj_billing-migration", { at: bar(4) + 0.2, duration: 1.3, style: "ring" });

// 3 · End card on the ending hit: logo, call to action, URL
const end = v.shot("end", bar(5), v.duration, { kind: "logo" });
add(end.el, `<div class="dm-bg"></div>`);
const card = add(
  end.el,
  `<div class="center end"><div class="end-logo"></div><div class="dm-cta" data-dm-cta>Start free trial</div><p class="url" data-dm-cta>harborly.example</p></div>`,
);
logo(v, { at: bar(5) - 0.1, variant: "wordmark", parent: card.querySelector(".end-logo") });
[...card.querySelectorAll("[data-dm-cta]")].forEach((node, i) => {
  tl.fromTo(node, { opacity: 0, y: 2 * u }, { opacity: 1, y: 0, duration: 0.6, ease: EASE }, bar(5) + 0.15 + i * 0.15);
});

transition.crossfade(intro, board, { at: HOOK_END - 0.25, duration: 0.4 });
transition.crossfade(board, end, { at: bar(5) - 0.3, duration: 0.45 });

v.ready();
