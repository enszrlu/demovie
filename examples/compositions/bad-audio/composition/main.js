// QA fixture: broken audio. Triggers DM-A04 (an audio file without provenance), S01 (a mix far too loud)
// and S02 (overlapping voice lines that also run past the end).
import { createVideo } from "/__demovie/runtime.js";

const v = await createVideo();
const shot = v.shot("title", 0, 6, { kind: "text" });
shot.el.innerHTML = `<p class="title">Projects board</p>`;
const end = v.shot("end", 6, 8, { kind: "logo" });
end.el.innerHTML = `<p class="dm-cta" data-dm-cta style="position:absolute;left:40%;top:45%">Start free trial</p>`;
v.ready();
