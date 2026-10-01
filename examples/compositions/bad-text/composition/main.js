// QA fixture: unreadable text. Triggers DM-T01 (too short), T02 (too small), T03 (clipped), T04 (low contrast), T05 (too much text).
import { createVideo } from "/__demovie/runtime.js";

const v = await createVideo();
const tl = v.timeline;
const shot = v.shot("text", 0, 6, { kind: "text" });
shot.el.innerHTML = `
  <h1 class="flash">Plan every launch on one board</h1>
  <p class="tiny">Projects board</p>
  <p class="clip">Every launch from planning to launched</p>
  <p class="faint">Velocity</p>
  <p class="extra">New project</p>`;
tl.fromTo(shot.el.querySelector(".flash"), { opacity: 0 }, { opacity: 1, duration: 0.01 }, 1);
tl.to(shot.el.querySelector(".flash"), { opacity: 0, duration: 0.01 }, 1.5);
const end = v.shot("end", 6, 8, { kind: "logo" });
end.el.innerHTML = `<p class="dm-cta" data-dm-cta style="position:absolute;left:40%;top:45%">Start free trial</p>`;
v.ready();
