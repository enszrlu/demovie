// Harborly — Projects board · launch · clean
// Every product pixel comes from a real capture; every camera, cursor and highlight target is an element id from its
// element map. Cuts land on bar lines of the music (v.bar), the ending hit on the end card.
import { createVideo, cursor, logo, screen, text, transition, typeText } from "/__demovie/runtime.js";

const v = await createVideo();
const tl = v.timeline;
const u = v.unit;
const vertical = v.height > v.width;
const bar = (n) => v.bar(n);
const EASE = "expo.out";

const add = (parent, markup) => {
  parent.insertAdjacentHTML("beforeend", markup);
  return parent.lastElementChild;
};

// Layout: a headline above a browser frame. In 9:16 the frame runs edge to edge and the camera frames cards, not
// whole columns, so the UI stays readable on a phone.
const frameWidth = vertical ? v.width : 1280;
const frameHeight = Math.round(frameWidth * (900 / 1440)) + Math.max(30, Math.round(frameWidth * 0.034));
const screenTop = vertical
  ? Math.round(v.safe.top + (v.height - v.safe.top - v.safe.bottom - frameHeight) * 0.72)
  : 196;
// Desktop captures are 2880 px wide (1440 CSS px @2x): never zoom past their native density (QA DM-G05).
const maxZoom = 2880 / frameWidth;
const zoomFor = (rect, fill = 0.86) =>
  Math.min(maxZoom * 0.95, (frameWidth * fill) / rect.width, ((frameWidth * 900) / 1440) * (fill / rect.height));

/** One headline at a time: words rise in, the line leaves quickly before the next one. */
function headline(shot, copy, at, out) {
  const h = add(shot.el, `<h2 class="dm-title headline">${copy}</h2>`);
  if (vertical) h.style.bottom = `${v.height - screenTop + 6 * u}px`;
  text.reveal(h, { at, by: "word", stagger: 0.055, duration: 0.8, ease: EASE });
  tl.to(h, { opacity: 0, y: -1.5 * u, duration: 0.35, ease: "power2.in" }, out);
  return h;
}

function browser(shot, capture, enterAt) {
  const app = screen(v, {
    capture,
    parent: shot.el,
    device: "browser",
    width: frameWidth,
    x: (v.width - frameWidth) / 2,
    y: screenTop,
  });
  tl.fromTo(app.el, { y: 8 * u, opacity: 0 }, { y: 0, opacity: 1, duration: 1.0, ease: EASE }, enterAt);
  return app;
}

// 1 · Title: the mark, then the message word by word
const intro = v.shot("intro", 0, bar(1), { kind: "title" });
add(intro.el, `<div class="dm-bg"></div>`);
const introBox = add(
  intro.el,
  `<div class="intro"><div class="intro-mark"></div><h1 class="dm-title intro-title">Every launch, on one board.</h1></div>`,
);
logo(v, { at: 0, variant: "mark", parent: introBox.querySelector(".intro-mark") });
text.reveal(introBox.querySelector(".intro-title"), { at: 0.2, by: "word", stagger: 0.07, duration: 0.9, ease: EASE });

// 2 · The Projects board: Planning → Launched, then health at a glance
const board = v.shot("board", bar(1), bar(6), { kind: "product" });
add(board.el, `<div class="dm-bg"></div>`);
const app = browser(board, "routes/app-projects@desktop", bar(1) - 0.3);
headline(board, "Every launch, from Planning to Launched.", bar(1) + 0.25, bar(3) + 0.9);
const planning = vertical
  ? app.rect("heading:planning", "link:holiday-campaign")
  : app.rect("heading:planning", "link:eu-data-residency");
const launched = vertical
  ? app.rect("heading:launched", "link:projects-board-beta")
  : app.rect("heading:launched", "link:spring-launch");
if (vertical) app.focus(planning, { at: bar(1) - 0.3, duration: 0, scale: zoomFor(planning, 0.62) });
app.focus(planning, { at: bar(1) + 1.1, duration: 1.1, scale: zoomFor(planning, 0.8), ease: "power3.inOut" });
app.focus(launched, { at: bar(2) + 1.0, duration: 1.4, scale: zoomFor(launched, 0.8), ease: "power3.inOut" });
app.reset({ at: bar(3) + 1.1, duration: 1.0, ease: "power3.inOut" });

headline(board, "Health shows at a glance.", bar(4), bar(6) - 0.45);
const atRisk = app.rect("link:android-app-v2", "link:billing-migration");
app.focus(atRisk, { at: bar(4) + 0.2, duration: 1.1, scale: zoomFor(atRisk, 0.78), ease: "power3.inOut" });
app.highlight("link:android-app-v2", { at: bar(4) + 1.5, duration: 1.5, style: "ring" });
app.highlight("link:billing-migration", { at: bar(5) + 0.9, duration: 1.4, style: "ring" });

// 3 · New project → the dialog → "Q4 Launch" → the new launch plan, its checklist and milestones
const flow = v.shot("flow", bar(6), bar(12), { kind: "product" });
add(flow.el, `<div class="dm-bg"></div>`);
const plan = browser(flow, "flows/create-project@desktop/board", bar(6) - 0.3);
headline(flow, "Start a launch plan from the board.", bar(6) + 0.3, bar(9) + 0.25);
// 9:16: start on the top bar so the New project button is large enough to follow
if (vertical) {
  const top = plan.rect("link:new-project", "heading:launched");
  plan.focus(top, { at: bar(6) - 0.3, duration: 0, scale: zoomFor(top, 0.7) });
}
const pointer = cursor(v, { style: "mac" });
pointer.show({ at: bar(6) + 0.3 });
pointer.moveTo(plan, "link:new-project", { at: bar(6) + 0.4, duration: 0.85 });
pointer.click({ at: bar(6) + 1.35 });
plan.swap("flows/create-project@desktop/dialog", { at: bar(6) + 1.5, duration: 0.3, transition: "crossfade" });
plan.focus("dialog:new-project", { at: bar(6) + 1.5, duration: 0.9, scale: vertical ? 1.75 : 1.5 });
pointer.moveTo(plan, "textbox:project-name", { at: bar(6) + 2.2, duration: 0.6 });
pointer.click({ at: bar(6) + 2.9 });
const typedAt = bar(6) + 3.05;
typeText(plan, "textbox:project-name", "Q4 Launch", { at: typedAt, cps: 14 });
pointer.moveTo(plan, "button:create-project", { at: bar(6) + 4.0, duration: 0.65 });
pointer.click({ at: bar(6) + 4.75 });
plan.swap("flows/create-project@desktop/created", { at: bar(6) + 4.95, duration: 0.35, transition: "crossfade" });
if (vertical) plan.focus("dm:project-header", { at: bar(6) + 4.95, duration: 0.7, scale: 1.7 });
else plan.reset({ at: bar(6) + 4.95, duration: 0.7 });
pointer.hide({ at: bar(6) + 5.3 });

headline(flow, "Every plan gets a checklist and milestones.", bar(9) + 0.6, bar(12) - 0.45);
plan.focus("generic:project-checklist", { at: bar(9) + 0.7, duration: 1.0, scale: vertical ? 1.9 : 1.45 });
plan.highlight("generic:project-checklist", { at: bar(9) + 1.7, duration: 1.6, style: "ring" });
plan.focus("generic:project-timeline", { at: bar(10) + 1.3, duration: 0.9, scale: vertical ? 2.1 : 1.6 });

// 4 · Back on the board: Q4 Launch now sits in Planning
const after = v.shot("after", bar(12), bar(14), { kind: "product" });
add(after.el, `<div class="dm-bg"></div>`);
const boardAfter = browser(after, "flows/create-project@desktop/board-after", bar(12) - 0.3);
headline(after, "Q4 Launch is on the board.", bar(12) + 0.25, bar(14) - 0.45);
const newCard = boardAfter.rect("link:q4-launch");
boardAfter.focus(newCard, { at: bar(12) + 0.6, duration: 1.0, scale: zoomFor(newCard, 0.55), ease: "power3.inOut" });
boardAfter.highlight("link:q4-launch", { at: bar(12) + 1.5, duration: 2.2, style: "ring" });

// 5 · End card on the ending hit: logo, call to action, URL
const end = v.shot("end", bar(14), v.duration, { kind: "logo" });
add(end.el, `<div class="dm-bg"></div>`);
const card = add(
  end.el,
  `<div class="center end"><div class="end-logo"></div><div class="dm-cta" data-dm-cta>Start free trial</div><p class="url" data-dm-cta>harborly.example</p></div>`,
);
logo(v, { at: bar(14) + 0.1, variant: "wordmark", parent: card.querySelector(".end-logo") });
[...card.querySelectorAll("[data-dm-cta]")].forEach((node, i) => {
  tl.fromTo(node, { opacity: 0, y: 2 * u }, { opacity: 1, y: 0, duration: 0.8, ease: EASE }, bar(14) + 0.55 + i * 0.2);
});

transition.crossfade(intro, board, { at: bar(1) - 0.3, duration: 0.5 });
transition.crossfade(board, flow, { at: bar(6) - 0.3, duration: 0.5 });
transition.crossfade(flow, after, { at: bar(12) - 0.3, duration: 0.5 });
transition.crossfade(after, end, { at: bar(14) - 0.3, duration: 0.5 });

v.ready();
