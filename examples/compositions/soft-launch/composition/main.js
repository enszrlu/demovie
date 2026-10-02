// Harborly — Plan your next launch · launch · soft
// Light tints, rounded shapes and gentle springs (back.out 1.3–1.6). Every product pixel comes from a real capture;
// every focus, highlight and cursor target is an element id from that capture's element map.
import { createVideo, cursor, logo, screen, text, transition } from "/__demovie/runtime.js";

const v = await createVideo();
const tl = v.timeline;
const u = v.unit;
const vertical = v.height > v.width;
const bar = (n) => v.bar(n);
const SPRING = "back.out(1.4)";

const add = (parent, markup) => {
  parent.insertAdjacentHTML("beforeend", markup);
  return parent.lastElementChild;
};

/** Brand tint plus two blurred blobs. Every shot drifts them on the same clock, so crossfades never jump. */
function backdrop(shot) {
  add(shot.el, `<div class="dm-bg"></div>`);
  const a = add(shot.el, `<div class="dm-blob blob-a"></div>`);
  const b = add(shot.el, `<div class="dm-blob blob-b"></div>`);
  tl.fromTo(a, { x: 0, y: 0 }, { x: -7 * u, y: 5 * u, duration: v.duration, ease: "sine.inOut" }, 0);
  tl.fromTo(b, { x: 0, y: 0 }, { x: 6 * u, y: -6 * u, duration: v.duration, ease: "sine.inOut" }, 0);
}

/** A feature pill over a headline; the pill pops, the words spring up. */
function copy(shot, kicker, headline, at) {
  const box = add(
    shot.el,
    `<div class="copy"><p class="dm-kicker">${kicker}</p><h2 class="dm-title headline">${headline}</h2></div>`,
  );
  const [pill, title] = box.children;
  tl.fromTo(pill, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.7, ease: "back.out(1.6)" }, at);
  text.reveal(title, { at: at + 0.15, by: "word", from: "below", stagger: 0.06, duration: 0.8, ease: SPRING });
}

/** A wrapper that bobs gently, one cycle per bar, so the device floats without touching its entrance tween. */
function floating(shot, from, to) {
  const wrap = add(shot.el, `<div class="float"></div>`);
  const half = (bar(1) - bar(0)) / 2;
  const cycles = Math.max(1, Math.round((to - from) / half));
  tl.fromTo(wrap, { y: 0 }, { y: -0.8 * u, duration: half, ease: "sine.inOut", yoyo: true, repeat: cycles - 1 }, from);
  return wrap;
}

/** Springs a screen up from a little lower and smaller. */
function springIn(app, at) {
  tl.fromTo(
    app.el,
    { opacity: 0, y: 9 * u, scale: 0.94 },
    { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: "back.out(1.3)" },
    at,
  );
}

// Layout: copy on the left and the device on the right (16:9), or copy on top and the device below (9:16).
const desktopWidth = vertical ? v.width - v.safe.left - v.safe.right : 1000;
const desktopFrame = Math.round((desktopWidth * 900) / 1440) + Math.max(30, Math.round(desktopWidth * 0.034));
const desktopBox = vertical
  ? { width: desktopWidth, x: v.safe.left, y: 715 }
  : {
      width: desktopWidth,
      x: v.width - v.safe.right - desktopWidth,
      y: Math.round((v.height - desktopFrame) / 2),
    };
const phoneWidth = vertical ? 420 : 400;
const phoneFrame = Math.round((phoneWidth * 844) / 390) + 2 * Math.round(phoneWidth * 0.045);
const phoneBox = {
  width: phoneWidth,
  x: Math.round((vertical ? v.width / 2 : 1400) - phoneWidth / 2 - Math.round(phoneWidth * 0.045)),
  y: vertical ? v.height - v.safe.bottom - phoneFrame : Math.round((v.height - phoneFrame) / 2),
};

// 1 · Title: the mark springs in, the title rises word by word
const intro = v.shot("intro", 0, bar(1), { kind: "title" });
backdrop(intro);
const title = add(
  intro.el,
  `<div class="intro"><div class="intro-mark"></div><h1 class="dm-title intro-title">Plan your next launch with Harborly</h1></div>`,
);
const markTile = title.querySelector(".intro-mark");
logo(v, { at: 0.2, variant: "mark", parent: markTile });
tl.fromTo(
  markTile,
  { opacity: 0, scale: 0.5, rotation: -10 },
  { opacity: 1, scale: 1, rotation: 0, duration: 1.0, ease: "back.out(1.6)" },
  0.2,
);
text.reveal(title.querySelector(".intro-title"), {
  at: 0.55,
  by: "word",
  from: "below",
  stagger: 0.08,
  duration: 0.9,
  ease: SPRING,
});

// 2 · Projects board on a phone: push in on Planning, two cards glow in turn
const board = v.shot("board", bar(1), bar(3), { kind: "product" });
backdrop(board);
copy(board, "Projects board", "See every launch at a glance.", bar(1) + 0.2);
const phone = screen(v, {
  capture: "routes/app-projects@mobile",
  parent: floating(board, bar(1) - 0.4, bar(3) + 0.4),
  device: "phone",
  ...phoneBox,
});
springIn(phone, bar(1) - 0.3);
phone.focus(phone.rect("heading:planning", "link:partner-api"), {
  at: bar(1) + 1.6,
  duration: 1.3,
  scale: 1.35,
  ease: "power2.inOut",
});
phone.highlight("link:holiday-campaign", { at: bar(1) + 3.0, duration: 2.0, style: "glow" });
phone.highlight("link:partner-api", { at: bar(1) + 3.6, duration: 1.6, style: "glow" });

// 3 · Team workload: the camera settles on the members table, Leo Park's row (86%, High) glows
const team = v.shot("team", bar(3), bar(5), { kind: "product" });
backdrop(team);
copy(team, "Team workload", "Spot overloaded teammates early.", bar(3) + 0.2);
const members = screen(v, {
  capture: "routes/app-team@desktop",
  parent: floating(team, bar(3) - 0.4, bar(5) + 0.4),
  device: "browser",
  ...desktopBox,
});
springIn(members, bar(3) - 0.3);
const table = members.rect(
  "row:name-role-email-active-projects-workload",
  "row:hs-hana-sato-data-analyst-hana-harborly-demo-4-3",
);
members.focus(table, { at: bar(3) + 1.4, duration: 1.3, scale: vertical ? 1.4 : 1.2, ease: "power2.inOut" });
members.highlight("row:lp-leo-park-engineering-lead-leo-harborly-demo-8", {
  at: bar(3) + 2.8,
  duration: 2.3,
  style: "glow",
});

// 4 · Launch checklist: ease onto the new plan's checklist; the cursor glides in and the row under it lights up
const plan = v.shot("checklist", bar(5), bar(7.5), { kind: "product" });
backdrop(plan);
copy(plan, "Launch checklist", "A clear owner for every item.", bar(5) + 0.2);
const project = screen(v, {
  capture: "flows/create-project@desktop/created",
  parent: floating(plan, bar(5) - 0.4, bar(7.5) + 0.4),
  device: "browser",
  ...desktopBox,
});
springIn(project, bar(5) - 0.3);
project.focus("generic:project-checklist", {
  at: bar(5) + 1.2,
  duration: 1.3,
  scale: vertical ? 1.6 : 1.7,
  ease: "power2.inOut",
});
const pointer = cursor(v, { style: "mac" });
const arrive = bar(5) + 3.6;
pointer.moveTo(project, "generic:project-checklist", { at: arrive - 1.1, duration: 1.1, ease: "power2.inOut" });
// The flow captured the hover over the checklist's center: show that real state the moment the cursor arrives.
project.swap("flows/create-project@desktop/checklist-hover", { at: arrive, transition: "cut" });
pointer.hide({ at: bar(7.5) - 0.5 });

// 5 · Tagline
const tagline = v.shot("tagline", bar(7.5), bar(9), { kind: "text" });
backdrop(tagline);
const line = add(
  tagline.el,
  `<div class="center"><h2 class="dm-title tagline">Plan, ship and measure every launch.</h2></div>`,
);
text.reveal(line.firstElementChild, {
  at: bar(7.5) + 0.3,
  by: "word",
  from: "below",
  stagger: 0.08,
  duration: 0.9,
  ease: SPRING,
});

// 6 · End card: the wordmark on a white card, then the call to action
const end = v.shot("end", bar(9), v.duration, { kind: "logo" });
backdrop(end);
const card = add(
  end.el,
  `<div class="center end"><div class="end-card"></div><div class="dm-cta" data-dm-cta>Start free trial</div><p class="url" data-dm-cta>harborly.example</p></div>`,
);
const [logoCard, button, url] = card.children;
tl.fromTo(
  logoCard,
  { scale: 0.85, opacity: 0 },
  { scale: 1, opacity: 1, duration: 1.0, ease: "back.out(1.5)" },
  bar(9),
);
logo(v, { at: bar(9) + 0.15, variant: "wordmark", parent: logoCard });
tl.fromTo(
  button,
  { opacity: 0, y: 3 * u, scale: 0.9 },
  { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: SPRING },
  bar(9) + 0.6,
);
tl.fromTo(url, { opacity: 0, y: 2 * u }, { opacity: 1, y: 0, duration: 0.9, ease: SPRING }, bar(9) + 0.8);

const fade = { duration: 0.8 };
transition.crossfade(intro, board, { at: bar(1) - 0.4, ...fade });
transition.crossfade(board, team, { at: bar(3) - 0.4, ...fade });
transition.crossfade(team, plan, { at: bar(5) - 0.4, ...fade });
transition.crossfade(plan, tagline, { at: bar(7.5) - 0.4, ...fade });
transition.crossfade(tagline, end, { at: bar(9) - 0.4, ...fade });

v.ready();
