# Example: bold-launch (style `bold`, 28 s, 16:9 + 9:16)

Source: `examples/compositions/bold-launch/`. "Plan, ship and measure" — kinetic type on the brand blue, every cut on
a bar line and every camera move on a beat of the synthesized music (energetic, 128 BPM). Three real Harborly captures
(a project page, the Projects board, Reports). QA: 0 errors, 0 warnings in both formats.

## Shots on the beat grid

| # | Bars | Kind | What happens |
|---|---|---|---|
| 1 | 0–2 | title | The tagline, ghosted, lights up one word per beat. |
| 2 | 2–5 | product | "Plan." — the Q3 Launch page; hard camera cuts to its checklist (bar 3) and timeline (bar 4). |
| 3 | 5–8 | product | "Ship." — the Projects board; whip-pans across the four columns on beats 22–25, landing on Launched. |
| 4 | 8–11 | product | "Measure." — Reports; cuts to Velocity (bar 9) and Cycle time (bar 10). |
| 5 | 11–13 | text | "Ready for your next launch?" lit word by word on the ink field. |
| 6 | 13–end | logo | Ending hit: wordmark on white over a brand-blue band with the CTA and URL. |

## Time everything from beats.json

```js
const beat = (n) => v.beat(n);
const bar = (n) => v.bar(n);
const plan = productShot("plan", 2, 5, { verb: "Plan.", proof: "Every launch gets a checklist and a timeline.",
  capture: "routes/app-projects-prj_launch@desktop" });
```

Why: `audio music` wrote `audio/beats.json` (and put a bar line on the final shot), so `v.bar(n)` / `v.beat(n)` give
cut times that land on the music. Re-run `audio music` after changing shot timing.

## Hard camera cuts that are still pure functions of t

```js
/** Hard camera cut on a beat: lands 8% tight, then settles. */
function punch(app, target, at, scale) {
  app.focus(target, { at, duration: 0, scale: scale * 1.08 });
  app.focus(target, { at, duration: 0.5, scale, ease: "expo.out" });
}
const checklist = plan.rect("generic:project-checklist");
punch(plan, checklist, bar(3), zoomFor(checklist));
```

Why: a zero-duration `focus` is a cut; the second `focus` adds the settle that makes it feel kinetic rather than
jumpy. Targets come from element ids; `rect()` unions frame whole regions (a board column is a heading plus its first
and last card).

## Stay crisp: cap the zoom at the capture's density

```js
// Desktop captures are 2880 px wide (1440 CSS px @2x): zoom no further than their native density (QA DM-G05).
const maxZoom = 2880 / screenWidth / 1.1;
const zoomFor = (rect, fill = 0.88) =>
  Math.min(maxZoom, (screenWidth * fill) / rect.width, (viewHeight * fill) / rect.height);
```

## Kinetic type that respects reading time

```js
function lightUp(el, at, first) {
  text.reveal(el, { at, by: "word", from: "fade", duration: 0.05, stagger: 0 });
  el.querySelectorAll(".dm-word").forEach((word, i) => {
    tl.fromTo(word, { color: GHOST }, { color: LIT, duration: 0.08, ease: "power1.out" }, beat(first + i));
  });
}
```

Why: the whole line is on screen (ghosted) from the start, so it is readable for the full shot (QA `DM-T01`), while the
lit word follows the beat. Big type is still sized in `v.unit`/`--dm-h` and stays inside the safe area.

## What makes it "bold" and not "AI look"

- Brand primary backgrounds and the brand's own font at 10–16% of the frame height — no neon, no gradients.
- Cuts are motivated by the beat and by content (checklist → timeline → board columns), not constant random cuts.
- Every number and label on screen is in the captures or the glossary; the ending has the logo **and** the CTA.
