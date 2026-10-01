// QA fixture: broken assets. Triggers DM-A01 (system-font fallback), A02 (404 image) and A03 (external request).
import { createVideo } from "/__demovie/runtime.js";

const v = await createVideo();
const shot = v.shot("assets", 0, 6, { kind: "text" });
shot.el.innerHTML = `
  <p class="system">Projects board</p>
  <img class="pic" src="./missing-screenshot.png" alt="">
  <img class="pic" style="top:60%" src="https://cdn.example.com/hero.png" alt="">`;
const end = v.shot("end", 6, 8, { kind: "logo" });
end.el.innerHTML = `<p class="dm-cta" data-dm-cta style="position:absolute;left:40%;top:45%">Start free trial</p>`;
v.ready();
