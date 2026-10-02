// Harborly — Health badges show an icon · changelog · clean
// What changed is shown in the product itself: real captures taken after the change, framed on the badges.
import { createVideo, logo, screen, text, transition } from "/__demovie/runtime.js";

const v = await createVideo();
const tl = v.timeline;
const u = v.unit;
const wide = v.width > v.height;
const bar = (n) => v.bar(n);
const EASE = "expo.out";

const add = (parent, markup) => {
  parent.insertAdjacentHTML("beforeend", markup);
  return parent.lastElementChild;
};
/** A part of an element's rect, in fractions of its size (still anchored to the element map). */
const part = (r, fx, fy, fw, fh) => ({
  x: r.x + r.width * fx,
  y: r.y + r.height * fy,
  width: r.width * fw,
  height: r.height * fh,
});

// 16:9: a headline above a browser frame; 1:1: the frame runs edge to edge under the headline.
const frameWidth = wide ? 1280 : v.width;
const viewHeight = Math.round((frameWidth * 900) / 1440);
const frameHeight = viewHeight + Math.max(30, Math.round(frameWidth * 0.034));
const screenTop = wide ? 196 : Math.round(v.height - v.safe.bottom - frameHeight + 2 * u);
const maxZoom = (2880 / frameWidth) * 0.95; // never past the captures' native density (QA DM-G05)
const zoomFor = (rect, fill) => Math.min(maxZoom, (frameWidth * fill) / rect.width, (viewHeight * fill) / rect.height);

function headline(shot, copy, at, out) {
  const h = add(shot.el, `<h2 class="dm-title headline">${copy}</h2>`);
  text.reveal(h, { at, by: "word", stagger: 0.055, duration: 0.8, ease: EASE });
  tl.to(h, { opacity: 0, y: -1.5 * u, duration: 0.35, ease: "power2.in" }, out);
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
  tl.fromTo(app.el, { y: 6 * u, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: EASE }, enterAt);
  return app;
}

// 1 · What's new
const intro = v.shot("intro", 0, bar(1), { kind: "title" });
add(intro.el, `<div class="dm-bg"></div>`);
const box = add(
  intro.el,
  `<div class="center"><p class="dm-kicker">What’s new in Harborly</p><h1 class="dm-title intro-title">Health badges now show an icon.</h1></div>`,
);
const [kicker, title] = box.children;
tl.fromTo(kicker, { opacity: 0, y: 1.5 * u }, { opacity: 1, y: 0, duration: 0.7, ease: EASE }, 0.1);
text.reveal(title, { at: 0.3, by: "word", stagger: 0.06, duration: 0.8, ease: EASE });

// 2 · The Projects board: one badge of each health, ringed in turn (badges carry data-demovie ids)
const board = v.shot("board", bar(1), bar(3), { kind: "product" });
add(board.el, `<div class="dm-bg"></div>`);
const app = browser(board, "routes/app-projects@desktop", bar(1) - 0.3);
headline(board, "On track, At risk, Off track.", bar(1) + 0.2, bar(3) - 0.45);
// The In progress column holds one card of each health: On track above, At risk and Off track below.
const column = app.rect("link:mobile-onboarding", "link:billing-migration");
const cards = app.rect("link:android-app-v2", "link:billing-migration");
app.focus(column, { at: bar(1) - 0.3, duration: 0, scale: zoomFor(column, 0.86) });
app.highlight("dm:health-prj_mobile-onboarding", { at: bar(1) + 0.4, duration: 1.0, style: "ring" });
app.focus(cards, { at: bar(1) + 1.3, duration: 0.9, scale: zoomFor(cards, 0.9), ease: "power3.inOut" });
app.highlight("dm:health-prj_android-app-v2", { at: bar(1) + 2.1, duration: 0.85, style: "ring" });
app.highlight("dm:health-prj_billing-migration", { at: bar(1) + 3.0, duration: 0.9, style: "ring" });

// 3 · The dashboard: the same badges in Upcoming launches
const dash = v.shot("dashboard", bar(3), bar(5), { kind: "product" });
add(dash.el, `<div class="dm-bg"></div>`);
const home = browser(dash, "routes/app@desktop", bar(3) - 0.3);
headline(dash, "The same badges on the dashboard.", bar(3) + 0.2, bar(5) - 0.45);
// The badge side of the first two upcoming launches (progress, health, date)
const upcoming = part(
  home.rect(
    "row:pricing-page-refresh-acme-rockets-so-owner-sam-o",
    "row:usage-analytics-kestrel-health-hs-owner-hana-sat",
  ),
  0.45,
  0,
  0.55,
  1,
);
home.focus(upcoming, { at: bar(3) + 0.3, duration: 1.2, scale: zoomFor(upcoming, 0.9), ease: "power3.inOut" });
home.highlight("dm:health-prj_usage-analytics", { at: bar(3) + 1.7, duration: 2.0, style: "ring" });

// 4 · End card on the ending hit
const end = v.shot("end", bar(5), v.duration, { kind: "logo" });
add(end.el, `<div class="dm-bg"></div>`);
const card = add(
  end.el,
  `<div class="center end"><div class="end-logo"></div><div class="dm-cta" data-dm-cta>Start free trial</div><p class="url" data-dm-cta>harborly.example</p></div>`,
);
logo(v, { at: bar(5) + 0.05, variant: "wordmark", parent: card.querySelector(".end-logo") });
[...card.querySelectorAll("[data-dm-cta]")].forEach((node, i) => {
  tl.fromTo(node, { opacity: 0, y: 2 * u }, { opacity: 1, y: 0, duration: 0.7, ease: EASE }, bar(5) + 0.4 + i * 0.2);
});

transition.crossfade(intro, board, { at: bar(1) - 0.3, duration: 0.5 });
transition.crossfade(board, dash, { at: bar(3) - 0.3, duration: 0.5 });
transition.crossfade(dash, end, { at: bar(5) - 0.3, duration: 0.5 });

v.ready();
