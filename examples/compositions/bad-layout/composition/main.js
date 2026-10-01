// QA fixture: broken layout. Triggers DM-L01 (outside the safe area), L02 (overlapping text), L03 (visible but off stage).
import { createVideo } from "/__demovie/runtime.js";

const v = await createVideo();
const shot = v.shot("layout", 0, 6, { kind: "text" });
shot.el.innerHTML = `
  <p class="edge">Harborly</p>
  <p class="a">Projects board</p>
  <p class="b">Launch checklist</p>
  <p class="away">Velocity</p>`;
const end = v.shot("end", 6, 8, { kind: "logo" });
end.el.innerHTML = `<p class="dm-cta" data-dm-cta style="position:absolute;left:40%;top:45%">Start free trial</p>`;
v.ready();
