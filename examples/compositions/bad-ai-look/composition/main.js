// QA fixture: the "AI look". Triggers DM-V01 (timecode/BPM HUD labels, a generic "Success" chip, three typefaces).
import { createVideo } from "/__demovie/runtime.js";

const v = await createVideo();
const shot = v.shot("hud", 0, 6, { kind: "text" });
shot.el.innerHTML = `<p class="hud">00:00:12:08 · 120 BPM</p><p class="chip">Success</p><p class="title">Projects board</p>`;
const end = v.shot("end", 6, 8, { kind: "logo" });
end.el.innerHTML = `<p class="dm-cta" data-dm-cta style="position:absolute;left:40%;top:45%">Start free trial</p>`;
v.ready();
