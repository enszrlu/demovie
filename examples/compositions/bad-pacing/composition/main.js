// QA fixture: frantic pacing. Triggers DM-P01 (6 cuts under 0.8 s), P02 (9 s is below the changelog range),
// P03 (no logo/CTA at the end) and P04 (a gap with no shot).
import { createVideo } from "/__demovie/runtime.js";

const v = await createVideo();
const words = ["Plan", "Ship", "Measure", "Launch", "Board", "Velocity"];
words.forEach((word, i) => {
  const shot = v.shot(`cut-${i}`, i * 0.5, i * 0.5 + 0.5, { kind: "text" });
  shot.el.innerHTML = `<p class="word">${word}</p>`;
});
const last = v.shot("last", 4.5, 9, { kind: "text" });
last.el.innerHTML = `<p class="word">Projects board</p>`;
v.ready();
