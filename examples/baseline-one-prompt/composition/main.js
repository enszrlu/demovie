// "Make a 30s launch video for Harborly's new Projects board." — written from that one prompt, without captures.
// Everything below is imagined: the dashboard, the numbers and the features. Comparison material only.
import { createVideo } from "/__demovie/runtime.js";

const v = await createVideo();
const tl = v.timeline;
const rand = v.random("baseline");
const add = (parent, markup) => {
  parent.insertAdjacentHTML("beforeend", markup);
  return parent.lastElementChild;
};

// Constant HUD chrome: timecode, REC dot, BPM, "frame" counter — the classic one-prompt tell.
const hud = v.shot("hud", 0, 30, { kind: "other" });
add(hud.el, `<div class="bg"></div><div class="grid"></div>`);
const tc = add(hud.el, `<div class="hud tl">REC ● 00:00:00:00</div>`);
add(hud.el, `<div class="hud tr">BPM 128 · 4K HDR</div>`);
const frame = add(hud.el, `<div class="hud bl">FRAME 0000</div>`);
add(hud.el, `<div class="hud br">HARBORLY.AI // LAUNCH OS</div>`);
v.onSeek((t) => {
  const f = Math.floor(t * 30);
  const s = Math.floor(t);
  tc.textContent = `REC ● 00:00:${String(s).padStart(2, "0")}:${String(f % 30).padStart(2, "0")}`;
  frame.textContent = `FRAME ${String(f).padStart(4, "0")}`;
});

function title(id, start, end, big, small) {
  const shot = v.shot(id, start, end, { kind: "title" });
  const box = add(shot.el, `<div class="center"><h1 class="neon">${big}</h1><p class="sub">${small}</p></div>`);
  tl.fromTo(
    box,
    { scale: 1.3, opacity: 0, filter: "blur(20px)" },
    { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.5 },
    start,
  );
  tl.to(box, { scale: 0.85, opacity: 0, duration: 0.3 }, end - 0.3);
}

// Fast cuts with invented claims
title("t1", 0, 2.4, "Introducing", "The future of launches is here");
title("t2", 2.4, 4.6, "Harborly AI", "Your autonomous launch co-pilot");

// An imagined dashboard with invented metrics
const dash = v.shot("dash", 4.6, 14, { kind: "product" });
const d = add(
  dash.el,
  `<div class="dash">
    <div class="card">Launch Velocity<b>+247%</b></div>
    <div class="card">Teams onboarded<b>12,480</b></div>
    <div class="card">AI Readiness Score<b>98.6</b></div>
    <div class="bars">${Array.from({ length: 14 }, () => "<i></i>").join("")}</div>
  </div>`,
);
tl.fromTo(
  d,
  { rotationX: 25, y: 300, opacity: 0 },
  { rotationX: 0, y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
  4.6,
);
d.querySelectorAll(".bars i").forEach((bar, i) => {
  tl.fromTo(
    bar,
    { height: "0%" },
    { height: `${30 + Math.round(rand() * 70)}%`, duration: 0.6, ease: "power2.out" },
    5.2 + i * 0.05,
  );
});
tl.to(d, { scale: 1.08, rotation: -2, duration: 4, ease: "none" }, 8);
const done = add(dash.el, `<div class="chip" style="left: 760px; top: 140px">✓ Done</div>`);
tl.fromTo(done, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(3)" }, 9.5);
const saved = add(dash.el, `<div class="chip" style="left: 1180px; top: 860px">Saved ✨</div>`);
tl.fromTo(saved, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(3)" }, 11);

title("t3", 14, 16.2, "AI-Powered", "Predictive launch scoring");
title("t4", 16.2, 18.4, "10x Faster", "Ship in minutes, not months");
title("t5", 18.4, 20.6, "Trusted", "by 50,000+ teams worldwide");
title("t6", 20.6, 22.8, "Zero Friction", "Seamless. Smart. Secure.");

// Emoji/confetti burst and a logo-only ending (no CTA)
const end = v.shot("end", 22.8, 30, { kind: "logo" });
const center = add(
  end.el,
  `<div class="center"><h1 class="logo">Harborly</h1><p class="sub">🚀 The Future of Launching 🚀</p></div>`,
);
tl.fromTo(
  center,
  { scale: 0.6, opacity: 0 },
  { scale: 1, opacity: 1, duration: 0.7, ease: "elastic.out(1, 0.5)" },
  22.9,
);
const colors = ["#a78bfa", "#60a5fa", "#f472b6", "#34d399", "#fbbf24"];
for (let i = 0; i < 70; i++) {
  const piece = add(end.el, `<div class="confetti" style="background:${colors[i % colors.length]}"></div>`);
  const x = rand() * 1920;
  tl.fromTo(
    piece,
    { x, y: -60, rotation: 0 },
    { x: x + (rand() - 0.5) * 400, y: 1140, rotation: rand() * 720, duration: 2.5 + rand() * 2, ease: "power1.in" },
    23 + rand() * 2,
  );
}

v.ready();
