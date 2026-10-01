// 2 · Product: a real capture ({{CAPTURE}})
const middle = v.shot("product", {{INTRO_END}}, D - {{END_LEN}}, { kind: "product" });
add(middle.el, `<div class="dm-bg"></div>`);
const app = screen(v, { capture: "{{CAPTURE}}", parent: middle.el, device: "browser" });
tl.fromTo(app.el, { opacity: 0, y: 6 * u }, { opacity: 1, y: 0, duration: {{DUR}}, ease: EASE }, {{INTRO_END}} - 0.2);
app.focus("{{FOCUS}}", { at: {{INTRO_END}} + 1.4, duration: 1.1 });
const pointer = cursor(v);
pointer.moveTo(app, "{{FOCUS}}", { at: {{INTRO_END}} + 2.2, duration: 0.8 });
app.highlight("{{FOCUS}}", { at: {{INTRO_END}} + 3.1, duration: 1.6, style: "ring" });
pointer.hide({ at: D - {{END_LEN}} - 1.4 });
app.reset({ at: D - {{END_LEN}} - 1.4, duration: 0.9 });
