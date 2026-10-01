// 2 · No captures yet: run `npx demovie capture`, then replace this shot with screen(v, { capture: "<id>" }).
const middle = v.shot("message", {{INTRO_END}}, D - {{END_LEN}}, { kind: "text" });
add(middle.el, `<div class="dm-bg"></div>`);
const message = add(middle.el, `<div class="center"><h2 class="dm-title">{{TAGLINE}}</h2></div>`).querySelector("h2");
text.reveal(message, { at: {{INTRO_END}} + 0.3, by: "word", stagger: 0.06, duration: {{DUR}}, ease: EASE });
