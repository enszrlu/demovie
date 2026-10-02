// Harborly — Velocity insights are here · launch · editorial
// Large display type on warm paper, slow 1.0–1.4 s moves, wipes like turning a page, generous whitespace.
// Every product pixel comes from a real capture; scroll, focus, highlight and callout targets are element ids.
import { callout, createVideo, logo, screen, text, transition } from "/__demovie/runtime.js";

const v = await createVideo();
const tl = v.timeline;
const vertical = v.height > v.width;
const bar = (n) => v.bar(n);
const SETTLE = "power3.out";
const MOVE = "power2.inOut";

const add = (parent, markup) => {
  parent.insertAdjacentHTML("beforeend", markup);
  return parent.lastElementChild;
};

// The figure: a borderless screen bleeding off the right edge (16:9) or both edges (9:16). The copy hangs on its
// top and bottom edges through CSS variables, so every spread shares one grid.
const figureWidth = vertical ? v.width : 1040;
const figureHeight = Math.round((figureWidth * 900) / 1440);
const figure = {
  width: figureWidth,
  x: v.width - figureWidth,
  y: vertical ? 760 : Math.round((v.height - figureHeight) / 2),
};
v.stage.style.setProperty("--figure-x", `${figure.x}px`);
v.stage.style.setProperty("--figure-top", `${figure.y}px`);
v.stage.style.setProperty("--figure-bottom", `${figure.y + figureHeight}px`);
// Desktop captures are 2880 px wide (1440 CSS px @2x): never zoom past their native density (QA DM-G05).
const zoomFor = (rect, fill = 0.9) =>
  Math.min(2880 / figureWidth / 1.1, (figureWidth * fill) / rect.width, (figureHeight * fill) / rect.height);

/** A hairline that draws from the left, slowly. */
function drawRule(el, at) {
  tl.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 1.3, ease: MOVE }, at);
}

/** Lines rise out of a mask. Until the reveal starts the block is hidden, not merely masked: masked lines are still
 * painted text, and anything reading the frame (QA included) would count them. */
function maskIn(el, at) {
  tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, at);
  text.reveal(el, { at, by: "line", from: "mask", stagger: 0.18, duration: 1.2, ease: SETTLE });
}

/** One spread: a pull quote, an optional caption and the figure. */
function spread(id, from, to, o) {
  const shot = v.shot(id, from, to, { kind: "product" });
  add(shot.el, `<div class="dm-bg"></div>`);
  const quote = add(shot.el, `<h2 class="dm-title quote">${o.quote}</h2>`);
  const app = screen(v, {
    capture: o.capture,
    parent: shot.el,
    device: "none",
    image: o.image ?? "screen",
    ...figure,
  });
  maskIn(quote, from + 0.5);
  if (o.caption) {
    const caption = add(shot.el, `<p class="caption">${o.caption}</p>`);
    tl.fromTo(caption, { opacity: 0 }, { opacity: 1, duration: 1.0, ease: "power1.inOut" }, from + 1.3);
  }
  return { shot, app };
}

// 1 · Cover: the feature itself as the cover image, a hairline under the kicker, the headline rising line by line
const intro = v.shot("intro", 0, bar(2), { kind: "title" });
add(intro.el, `<div class="dm-bg"></div>`);
const coverImage = screen(v, { capture: "routes/app@desktop", parent: intro.el, device: "none", ...figure });
const velocityCard = coverImage.rect("generic:velocity-chart");
coverImage.focus(velocityCard, { at: 0, duration: 0, scale: zoomFor(velocityCard, 0.84) });
coverImage.focus(velocityCard, { at: 0.2, duration: bar(2), scale: zoomFor(velocityCard, 0.94), ease: "sine.inOut" });
const opening = add(
  intro.el,
  `<div class="opening"><p class="kicker">What’s new in Harborly</p><div class="rule"></div><h1 class="dm-title display">Velocity insights are here.</h1></div>`,
);
const [kicker, rule, display] = opening.children;
// The first frame is already a page: the headline rises from frame 0 while the hairline draws under the kicker.
text.reveal(display, { at: 0, by: "line", from: "below", stagger: 0.24, duration: 1.4, ease: SETTLE });
drawRule(rule, 0.1);
tl.fromTo(kicker, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 1.0, ease: SETTLE }, 0.4);

// 2 · The homepage, full length: a ring on the announcement, then a slow scroll down to the feature cards
const home = spread("home", bar(2), bar(5), {
  quote: "One calm workspace for every launch.",
  caption: "The Harborly homepage",
  capture: "routes/index@desktop",
  image: "full",
});
home.app.highlight("link:new-velocity-insights-are-here", { at: bar(2) + 1.2, duration: 2.0, style: "ring" });
home.app.scroll("heading:everything-a-launch-needs-in-one-place", { at: bar(3) + 0.2, duration: 2.6, ease: MOVE });
home.app.highlight("heading:velocity-insights", { at: bar(4) + 0.4, duration: 1.9, style: "ring" });

// 3 · The changelog: a slow push onto the Velocity insights entry
const changelog = spread("changelog", bar(5), bar(7.5), {
  quote: "Planning starts from real numbers.",
  caption: "The Harborly changelog, Version 2.8",
  capture: "routes/changelog@desktop",
});
// Frame the whole entry — date column through the start of the next one — from the headings around it.
const entry = changelog.app.rect(
  "heading:what-s-new-in-harborly",
  "heading:velocity-insights",
  "heading:launch-checklist-templates",
);
changelog.app.focus(entry, { at: bar(5) + 1.0, duration: 1.4, scale: zoomFor(entry), ease: MOVE });

// 4 · Reports: a slow push onto the Velocity chart, then a hairline annotation
const reports = spread("reports", bar(7.5), bar(10), {
  quote: "See how much your team ships every week.",
  capture: "routes/app-reports@desktop",
});
const chart = reports.app.rect("heading:velocity", "application");
// A looser framing in 16:9 leaves the chart's left edge far enough inside the figure for a note in the margin.
reports.app.focus(chart, {
  at: bar(7.5) + 1.0,
  duration: 1.4,
  scale: zoomFor(chart, vertical ? 0.9 : 0.8),
  ease: MOVE,
});
// A margin note in 16:9 (the quote column has room below the quote); below the chart in 9:16.
callout(reports.app, "application", {
  label: "Completed vs. committed",
  at: bar(7.5) + 2.6,
  duration: bar(10) - bar(7.5) - 3.3,
  side: vertical ? "bottom" : "left",
});

// 5 · Back cover: wordmark as masthead, the tagline in display type, an underlined call to action
const end = v.shot("end", bar(10), v.duration, { kind: "logo" });
add(end.el, `<div class="dm-bg"></div>`);
const cover = add(
  end.el,
  `<div class="cover"><div class="cover-logo"></div><div class="rule"></div><h2 class="dm-title cover-line">Plan, ship and measure every launch.</h2><p class="dm-cta" data-dm-cta>Start free trial — harborly.example</p></div>`,
);
const [coverLogo, coverRule, coverLine, cta] = cover.children;
// The cover sets itself while the page turns, so it lands on the ending hit already composed.
logo(v, { at: bar(10) - 0.5, variant: "wordmark", parent: coverLogo });
drawRule(coverRule, bar(10) - 0.4);
maskIn(coverLine, bar(10) - 0.2);
tl.fromTo(cta, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.1, ease: SETTLE }, bar(10) + 0.9);

// Page turns: slow wipes that reveal each spread from the right
const turn = { duration: 1.2, direction: "left" };
transition.wipe(intro, home.shot, { at: bar(2) - 0.6, ...turn });
transition.wipe(home.shot, changelog.shot, { at: bar(5) - 0.6, ...turn });
transition.wipe(changelog.shot, reports.shot, { at: bar(7.5) - 0.6, ...turn });
transition.wipe(reports.shot, end, { at: bar(10) - 0.6, ...turn });

v.ready();
