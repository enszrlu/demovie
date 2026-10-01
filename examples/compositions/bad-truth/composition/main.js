// QA fixture: untruthful video. Triggers DM-G01 (click without a target), G02 (invented vocabulary),
// G03 (a product shot with a hand-drawn "UI" instead of a capture), G04 (an invented number), G05 (upscaled capture).
import { createVideo, cursor, screen } from "/__demovie/runtime.js";

const v = await createVideo();
const claim = v.shot("claim", 0, 3, { kind: "text" });
claim.el.innerHTML = `<p class="claim">Powered by Quantum Synergy, 47% faster</p>`;
const fake = v.shot("fake", 3, 5, { kind: "product" });
fake.el.innerHTML = `<div class="fake-ui"></div>`;
const zoom = v.shot("zoom", 5, 8, { kind: "product" });
const app = screen(v, { capture: "routes/app@desktop", parent: zoom.el });
app.focus("heading:velocity", { at: 5.2, duration: 0.6, scale: 6 });
const pointer = cursor(v);
pointer.click({ at: 7 });
const end = v.shot("end", 8, 10, { kind: "logo" });
end.el.innerHTML = `<p class="dm-cta" data-dm-cta style="position:absolute;left:40%;top:45%">Start free trial</p>`;
v.ready();
