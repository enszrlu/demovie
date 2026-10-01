// QA fixture: a hero loop that doesn't loop. Triggers DM-P05 (first and last frames differ).
import { createVideo } from "/__demovie/runtime.js";

const v = await createVideo();
const shot = v.shot("loop", 0, 6, { kind: "other" });
shot.el.innerHTML = `<div class="dm-bg"></div><div class="slab"></div>`;
v.timeline.to(shot.el.querySelector(".slab"), { x: 900, duration: 6, ease: "none" }, 0);
v.ready();
