// QA fixture: non-deterministic composition. Triggers DM-R01 (pixels depend on real randomness),
// R02 (blank frames), R03 (a stray GSAP tween), R04 (an unregistered CSS animation), R05 (a timer after ready).
import { createVideo } from "/__demovie/runtime.js";

const v = await createVideo();
v.shot("blank", 0, 1.5, { kind: "other" });
const shot = v.shot("motion", 1.5, 6, { kind: "other" });
shot.el.innerHTML = `<p class="title">Projects board</p><div class="jitter"></div><div class="pulse"></div>`;
const jitter = shot.el.querySelector(".jitter");
v.gsap.to(shot.el.querySelector(".title"), { x: 200, duration: 2 });
v.onSeek(() => {
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  jitter.style.transform = `translateX(${r[0] % 400}px)`;
  setTimeout(() => {}, 0);
});
const end = v.shot("end", 6, 8, { kind: "logo" });
end.el.innerHTML = `<p class="dm-cta" data-dm-cta style="position:absolute;left:40%;top:45%">Start free trial</p>`;
v.ready();
