// Harborly — Plan, ship and measure · launch · bold
// Kinetic type on the brand blue. Every cut lands on a bar line of the music (v.bar) and every camera move on a beat
// (v.beat). Product pixels come from real captures; every focus/highlight target is an element id from its map.
import { createVideo, logo, screen, text } from "/__demovie/runtime.js";

const v = await createVideo();
const tl = v.timeline;
const vertical = v.height > v.width;
const beat = (n) => v.beat(n);
const bar = (n) => v.bar(n);

const add = (parent, markup) => {
  parent.insertAdjacentHTML("beforeend", markup);
  return parent.lastElementChild;
};

// Screens run flush into the bottom-right corner (16:9) or edge to edge (9:16). They never extend past the stage, so
// a camera move toward the capture's edge never pushes the target off-frame.
const screenWidth = vertical ? v.width : 1240;
const viewHeight = Math.round((screenWidth * 900) / 1440);
const frameHeight = viewHeight + Math.max(30, Math.round(screenWidth * 0.034));
const screenBox = vertical
  ? { width: screenWidth, x: 0, y: 700 }
  : { width: screenWidth, x: v.width - screenWidth, y: v.height - frameHeight };
const screenFrom = vertical ? { yPercent: 25 } : { xPercent: 10, yPercent: 10 };
// Desktop captures are 2880 px wide (1440 CSS px @2x): zoom no further than their native density (QA DM-G05).
const maxZoom = 2880 / screenWidth / 1.1;
/** Camera scale that fits a stage-px rect into the screen. */
const zoomFor = (rect, fill = 0.88) =>
  Math.min(maxZoom, (screenWidth * fill) / rect.width, (viewHeight * fill) / rect.height);

/** Hard camera cut on a beat: lands 8% tight, then settles (camera moves are pure functions of t). */
function punch(app, target, at, scale) {
  app.focus(target, { at, duration: 0, scale: scale * 1.08 });
  app.focus(target, { at, duration: 0.5, scale, ease: "expo.out" });
}

const GHOST = "rgba(255, 255, 255, 0.24)";
const LIT = "rgba(255, 255, 255, 1)";

/** Set a headline ghosted at `at`, then light one word per beat from beat `first`. */
function lightUp(el, at, first) {
  text.reveal(el, { at, by: "word", from: "fade", duration: 0.05, stagger: 0 });
  el.querySelectorAll(".dm-word").forEach((word, i) => {
    tl.fromTo(word, { color: GHOST }, { color: LIT, duration: 0.08, ease: "power1.out" }, beat(first + i));
  });
}

/** A product shot: the verb top-left, its proof line, and a real capture that rises in on the cut. */
function productShot(id, fromBar, toBar, o) {
  const at = bar(fromBar);
  const shot = v.shot(id, at, bar(toBar), { kind: "product" });
  add(shot.el, `<div class="dm-bg"></div>`);
  const verb = add(shot.el, `<h2 class="dm-title verb">${o.verb}</h2>`);
  const proof = add(shot.el, `<p class="proof">${o.proof}</p>`);
  const app = screen(v, { capture: o.capture, parent: shot.el, device: "browser", ...screenBox });
  tl.fromTo(app.el, { ...screenFrom }, { xPercent: 0, yPercent: 0, duration: 0.6, ease: "expo.out" }, at);
  text.reveal(verb, { at, by: "char", from: "below", stagger: 0.035, duration: 0.55, ease: "expo.out" });
  text.reveal(proof, { at: beat(fromBar * 4 + 1), by: "word", from: "below", stagger: 0.04, duration: 0.5 });
  return app;
}

// 1 · Title: the tagline, one word lit per beat
const intro = v.shot("intro", 0, bar(2), { kind: "title" });
add(intro.el, `<div class="dm-bg"></div>`);
const tagline = add(intro.el, `<h1 class="dm-title kinetic">Plan, ship and measure every launch.</h1>`);
lightUp(tagline, 0, 0);
tl.fromTo(tagline, { scale: 1 }, { scale: 1.04, duration: bar(2), ease: "power1.inOut", transformOrigin: "0% 50%" }, 0);

// 2 · Plan: the Q3 Launch project page; cuts to its checklist on bar 3 and its timeline on bar 4
const plan = productShot("plan", 2, 5, {
  verb: "Plan.",
  proof: "Every launch gets a checklist and a timeline.",
  capture: "routes/app-projects-prj_launch@desktop",
});
const checklist = plan.rect("generic:project-checklist");
const timeline = plan.rect("generic:project-timeline");
punch(plan, checklist, bar(3), zoomFor(checklist));
plan.highlight("generic:project-checklist", { at: beat(13), duration: bar(4) - beat(13) - 0.15, style: "ring" });
punch(plan, timeline, bar(4), zoomFor(timeline, 0.8));
plan.highlight("generic:project-timeline", { at: beat(17), duration: bar(5) - beat(17) - 0.15, style: "ring" });

// 3 · Ship: the Projects board; whip-pans across the four columns on beats 22–25, landing on Launched
const ship = productShot("ship", 5, 8, {
  verb: "Ship.",
  proof: "Every project, from Planning to Launched.",
  capture: "routes/app-projects@desktop",
});
const columns = [
  ship.rect("heading:planning", "link:holiday-campaign", "link:eu-data-residency"),
  ship.rect("heading:in-progress", "link:q3-launch", "link:billing-migration"),
  ship.rect("heading:review", "link:pricing-page-refresh", "link:usage-analytics"),
  ship.rect("heading:launched", "link:projects-board-beta", "link:spring-launch"),
];
// Tight enough that one column fills the screen per beat; the last pan settles on Launched, framed whole.
columns.forEach((rect, i) => {
  const scale = i === columns.length - 1 ? zoomFor(rect, 0.9) : maxZoom;
  ship.focus(rect, { at: beat(22 + i), duration: 0.34, scale, ease: "expo.inOut" });
});
["link:projects-board-beta", "link:help-center-revamp", "link:spring-launch"].forEach((id, i) => {
  ship.highlight(id, { at: beat(26 + i), duration: bar(8) - beat(26 + i) - 0.15, style: "ring" });
});

// 4 · Measure: Reports; cuts to Velocity on bar 9 and Cycle time on bar 10
const measure = productShot("measure", 8, 11, {
  verb: "Measure.",
  proof: "Velocity and cycle time, in Reports.",
  capture: "routes/app-reports@desktop",
});
const velocity = measure.rect("heading:velocity", "application");
const cycleTime = measure.rect("heading:cycle-time#2", "application#2");
punch(measure, velocity, bar(9), zoomFor(velocity));
measure.highlight("application", { at: beat(37), duration: bar(10) - beat(37) - 0.15, style: "ring" });
punch(measure, cycleTime, bar(10), zoomFor(cycleTime));
measure.highlight("application#2", { at: beat(41), duration: bar(11) - beat(41) - 0.15, style: "ring" });

// 5 · The question, lit word by word on the ink field
const ready = v.shot("ready", bar(11), bar(13), { kind: "text" });
add(ready.el, `<div class="dm-bg dm-bg--ink"></div>`);
const question = add(ready.el, `<h2 class="dm-title kinetic">Ready for your next launch?</h2>`);
lightUp(question, bar(11), 44);

// 6 · End card on the ending hit: the wordmark on white, the call to action on a brand-blue band
const end = v.shot("end", bar(13), v.duration, { kind: "logo" });
add(end.el, `<div class="dm-bg"></div>`);
add(end.el, `<div class="end-top"></div>`);
const mark = add(end.el, `<div class="end-logo"></div>`);
logo(v, { at: bar(13) + 0.05, variant: "wordmark", parent: mark });
const cta = add(
  end.el,
  `<div class="end-cta"><div class="dm-cta" data-dm-cta>Start free trial</div><p class="url" data-dm-cta>harborly.example</p></div>`,
);
[...cta.children].forEach((node, i) => {
  tl.fromTo(
    node,
    { opacity: 0, yPercent: 40 },
    { opacity: 1, yPercent: 0, duration: 0.5, ease: "expo.out" },
    beat(53 + i),
  );
});

v.ready();
