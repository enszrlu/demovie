# Example: soft-launch (style `soft`, 30 s, 16:9 + 9:16)

Source: `examples/compositions/soft-launch/`. "Plan your next launch with Harborly" — light brand tints, drifting
blobs, rounded device frames and gentle springs, over calm synthesized music (88 BPM). Four real captures, including a
mobile capture and a captured hover state. QA: 0 errors, 0 warnings in both formats.

## Shots

| # | Time | Kind | What happens |
|---|---|---|---|
| 1 | 0–bar 1 | title | The logo mark springs in on a white tile; the title rises word by word. |
| 2 | bars 1–3 | product | The Projects page on a **phone** (`routes/app-projects@mobile`) floats up; push-in on Planning; two cards glow in turn. |
| 3 | bars 3–5 | product | Team page; the camera settles on the members table; one teammate's row (86%, High) glows. |
| 4 | bars 5–7.5 | product | The new project's checklist; the cursor glides in and the **real hover state** appears as it arrives. |
| 5 | bars 7.5–9 | text | The glossary tagline. |
| 6 | bar 9–end | logo | Wordmark on a white rounded card; CTA pill and URL spring in. |

## Springs, not bounces

```js
const SPRING = "back.out(1.4)";
function springIn(app, at) {
  tl.fromTo(app.el, { opacity: 0, y: 9 * u, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: "back.out(1.3)" }, at);
}
```

Why: `back.out(1.2–1.5)` overshoots just enough to feel friendly. Scales start at 0.94, not 0, and moves are short.

## Floating devices without breaking determinism

```js
/** A wrapper that bobs gently, one cycle per bar, so the device floats without touching its entrance tween. */
function floating(shot, from, to) {
  const wrap = add(shot.el, `<div class="float"></div>`);
  const half = (bar(1) - bar(0)) / 2;
  const cycles = Math.max(1, Math.round((to - from) / half));
  tl.fromTo(wrap, { y: 0 }, { y: -0.8 * u, duration: half, ease: "sine.inOut", yoyo: true, repeat: cycles - 1 }, from);
  return wrap;
}
const phone = screen(v, { capture: "routes/app-projects@mobile", parent: floating(board, bar(1) - 0.4, bar(3) + 0.4), device: "phone", ...phoneBox });
```

Why: idle motion is a finite, repeated tween on `v.timeline` (never a CSS `infinite` animation), so every frame is a
pure function of t. Wrapping the screen keeps the float independent from its entrance and camera moves.

## A captured hover state, swapped in when the cursor arrives

```js
const arrive = bar(5) + 3.6;
pointer.moveTo(project, "generic:project-checklist", { at: arrive - 1.1, duration: 1.1, ease: "power2.inOut" });
// The flow captured the hover over the checklist's center: show that real state the moment the cursor arrives.
project.swap("flows/create-project@desktop/checklist-hover", { at: arrive, transition: "cut" });
```

Why: the hover highlight is the app's own, captured by the `create-project` flow (`hover` step, then `capture`) — not
drawn by the composition.

## Soft backgrounds that don't jump between shots

```js
function backdrop(shot) {
  add(shot.el, `<div class="dm-bg"></div>`);
  const a = add(shot.el, `<div class="dm-blob blob-a"></div>`);
  tl.fromTo(a, { x: 0, y: 0 }, { x: -7 * u, y: 5 * u, duration: v.duration, ease: "sine.inOut" }, 0);
}
```

Why: every shot draws its blobs on the same clock (from 0 to the video's end), so a crossfade between two shots shows
the blobs in the same place.
