// {{TITLE_COMMENT}} — scaffolded by `demovie new` ({{TYPE}}, {{STYLE}}).
// Replace the copy and beats with your storyboard. Product UI must come from screen() with real captures,
// and every cursor/focus/highlight target from an element id in the capture's elements.json.
import { createVideo, cursor, logo, screen, text, transition } from "/__demovie/runtime.js";

const v = await createVideo();
const tl = v.timeline;
const D = v.duration;
const u = v.unit;
const EASE = "{{EASE}}";
const add = (parent, markup) => {
  parent.insertAdjacentHTML("beforeend", markup);
  return parent.lastElementChild;
};

// 1 · Title
const intro = v.shot("intro", 0, {{INTRO_END}}, { kind: "title" });
add(intro.el, `<div class="dm-bg"></div>`);
const title = add(intro.el, `<div class="center"><h1 class="dm-title">{{TITLE}}</h1></div>`).querySelector("h1");
text.reveal(title, { at: 0.2, by: "word", stagger: 0.06, duration: {{DUR}}, ease: EASE });

{{MIDDLE}}

// 3 · End card: logo + call to action
const end = v.shot("end", D - {{END_LEN}}, D, { kind: "logo" });
add(end.el, `<div class="dm-bg"></div>`);
const card = add(end.el, `<div class="center end"><div class="end-logo"></div>{{CTA_HTML}}</div>`);
logo(v, { at: D - {{END_LEN}} + 0.2, parent: card.querySelector(".end-logo") });
for (const [i, node] of [...card.querySelectorAll("[data-dm-cta]")].entries()) {
  tl.fromTo(node, { opacity: 0, y: 2 * u }, { opacity: 1, y: 0, duration: {{DUR}}, ease: EASE }, D - {{END_LEN}} + 0.6 + i * 0.2);
}

transition.crossfade(intro, middle, { at: {{INTRO_END}} - 0.3, duration: 0.5 });
transition.crossfade(middle, end, { at: D - {{END_LEN}} - 0.3, duration: 0.5 });

v.ready();
