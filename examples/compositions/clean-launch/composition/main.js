// Harborly — Projects board · launch · clean
// Every product pixel comes from a real capture; every cursor target is an element id from its element map.
import { createVideo, cursor, logo, screen, text, transition, typeText } from "/__demovie/runtime.js";

const v = await createVideo();
const tl = v.timeline;
const vertical = v.height > v.width;
const u = v.unit;

const add = (parent, markup) => {
  parent.insertAdjacentHTML("beforeend", markup);
  return parent.lastElementChild;
};

// Layout: a headline above a browser frame, centered as a group inside the safe area.
const frameWidth = vertical ? v.width - v.safe.left - v.safe.right : 1300;
const frameHeight = Math.round(frameWidth * (900 / 1440)) + Math.max(30, Math.round(frameWidth * 0.034));
const screenTop = vertical
  ? Math.round(v.safe.top + (v.height - v.safe.top - v.safe.bottom - frameHeight) * 0.62)
  : 186;

function headline(shot, copy, at, out) {
  const h = add(shot.el, `<h2 class="dm-title headline">${copy}</h2>`);
  if (vertical) h.style.bottom = `${v.height - screenTop + 7 * u}px`;
  text.reveal(h, { at, by: "word", stagger: 0.055, duration: 0.8, ease: "expo.out" });
  tl.to(h, { opacity: 0, y: -1.5 * u, duration: 0.4, ease: "power2.in" }, out);
  return h;
}

function productScreen(shot, capture) {
  return screen(v, { capture, parent: shot.el, device: "browser", width: frameWidth, y: screenTop });
}

// 1 · Title
const intro = v.shot("intro", 0, 3.4, { kind: "title" });
add(intro.el, `<div class="dm-bg"></div>`);
const introBox = add(
  intro.el,
  `<div class="intro"><div class="intro-mark"></div><h1 class="dm-title intro-title">Meet the Projects board</h1></div>`,
);
logo(v, { at: 0, variant: "mark", parent: introBox.querySelector(".intro-mark") });
text.reveal(introBox.querySelector(".intro-title"), {
  at: 0.25,
  by: "word",
  stagger: 0.07,
  duration: 0.9,
  ease: "expo.out",
});

// 2 · Product: the board → create a project → its launch plan
const product = v.shot("board", 3.4, 20.4, { kind: "product" });
add(product.el, `<div class="dm-bg"></div>`);
const app = productScreen(product, "flows/create-project@desktop/board");
tl.fromTo(app.el, { y: 10 * u, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: "expo.out" }, 3.2);

headline(product, "Every launch, from planning to launched.", 3.6, 8.1);
const column = [app.rect("link:q3-launch"), app.rect("link:billing-migration")];
const columnRect = {
  x: column[0].x,
  y: column[0].y,
  width: column[0].width,
  height: column[1].y + column[1].height - column[0].y,
};
if (vertical) app.focus("link:q3-launch", { at: 4.8, duration: 1.2, scale: 2.2 });
else app.focus(columnRect, { at: 4.8, duration: 1.2, scale: 1.35 });
const pointer = cursor(v, { style: "mac" });
pointer.moveTo(app, "link:q3-launch", { at: 5.8, duration: 0.8 });
app.highlight("link:q3-launch", { at: 6.6, duration: 1.6, style: "ring" });
app.reset({ at: 8.0, duration: 0.9 });

headline(product, "Start a launch plan from the board.", 8.5, 13.2);
pointer.moveTo(app, "link:new-project", { at: 8.9, duration: 0.85 });
pointer.click({ at: 9.85 });
app.swap("flows/create-project@desktop/dialog", { at: 10.0, duration: 0.3, transition: "crossfade" });
app.focus("dialog:new-project", { at: 10.3, duration: 0.9, scale: vertical ? 1.75 : 1.55 });
pointer.moveTo(app, "textbox:project-name", { at: 10.6, duration: 0.6 });
pointer.click({ at: 11.3 });
typeText(app, "textbox:project-name", "Q4 Launch", { at: 11.45, cps: 14 });
pointer.moveTo(app, "button:create-project", { at: 12.3, duration: 0.65 });
pointer.click({ at: 13.05 });
app.swap("flows/create-project@desktop/created", { at: 13.25, duration: 0.35, transition: "crossfade" });
app.reset({ at: 13.25, duration: 0.7 });
pointer.hide({ at: 13.6 });

headline(product, "Every plan gets a checklist and milestones.", 13.6, 19.9);
app.focus("generic:project-checklist", { at: 14.4, duration: 1.1, scale: vertical ? 1.9 : 1.45 });
app.highlight("generic:project-checklist", { at: 15.5, duration: 1.9, style: "ring" });
app.focus("generic:project-timeline", { at: 17.6, duration: 1.0, scale: vertical ? 2.2 : 1.6 });
app.reset({ at: 19.3, duration: 0.9 });

// 3 · Product: velocity on the dashboard
const dashboard = v.shot("velocity", 20.4, 26.4, { kind: "product" });
add(dashboard.el, `<div class="dm-bg"></div>`);
const dash = productScreen(dashboard, "routes/app@desktop");
headline(dashboard, "Then measure velocity, week by week.", 20.8, 25.9);
dash.focus("generic:velocity-chart", { at: 21.5, duration: 1.4, scale: vertical ? 1.75 : 1.4 });

// 4 · Tagline
const tagline = v.shot("tagline", 26.4, 30.4, { kind: "text" });
add(tagline.el, `<div class="dm-bg"></div>`);
const tag = add(
  tagline.el,
  `<div class="center"><h2 class="dm-title tagline">Plan, ship and measure every launch.</h2></div>`,
);
text.reveal(tag.querySelector(".tagline"), { at: 26.6, by: "word", stagger: 0.07, duration: 0.9, ease: "expo.out" });

// 5 · End card: logo + CTA
const end = v.shot("end", 30.4, 35, { kind: "logo" });
add(end.el, `<div class="dm-bg"></div>`);
const card = add(
  end.el,
  `<div class="center end"><div class="end-logo"></div><div class="dm-cta" data-dm-cta>Start free trial</div><p class="url" data-dm-cta>harborly.example</p></div>`,
);
logo(v, { at: 30.55, variant: "wordmark", parent: card.querySelector(".end-logo") });
tl.fromTo(
  card.querySelector(".dm-cta"),
  { opacity: 0, y: 2 * u },
  { opacity: 1, y: 0, duration: 0.8, ease: "expo.out" },
  31.0,
);
tl.fromTo(
  card.querySelector(".url"),
  { opacity: 0, y: 1.5 * u },
  { opacity: 1, y: 0, duration: 0.8, ease: "expo.out" },
  31.2,
);

transition.crossfade(intro, product, { at: 3.1, duration: 0.5 });
transition.crossfade(product, dashboard, { at: 20.1, duration: 0.5 });
transition.crossfade(dashboard, tagline, { at: 26.1, duration: 0.5 });
transition.crossfade(tagline, end, { at: 30.1, duration: 0.5 });

v.ready();
