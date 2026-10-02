# Example: clean-launch (style `clean`, 35 s, 16:9 + 9:16)

Source: `examples/compositions/clean-launch/` in the demovie repo. A launch video for Harborly's Projects board built
only from real captures of the Harborly fixture app. QA: 0 errors, 0 warnings in both formats; music + 16 SFX cues,
mixed to −16 LUFS.

## Storyboard (5 shots)

| # | Time | Kind | What happens |
|---|---|---|---|
| 1 | 0–3.4 | title | Logo mark; "Meet the Projects board" rises word by word. |
| 2 | 3.4–20.4 | product | Board in a browser frame → push in on a column → cursor to *Q3 Launch* (ring) → *New project* → dialog → types "Q4 Launch" → *Create project* → the new project's checklist and timeline. |
| 3 | 20.4–26.4 | product | Dashboard; camera drifts to the velocity chart. |
| 4 | 26.4–30.4 | text | The glossary tagline. |
| 5 | 30.4–35 | logo | Wordmark, CTA button, URL — held 4.6 s; the music's ending hit lands at 30.4. |

## One layout for both formats

```js
const vertical = v.height > v.width;
const u = v.unit; // 1% of the short side
// A headline above a browser frame, centered as a group inside the safe area.
const frameWidth = vertical ? v.width - v.safe.left - v.safe.right : 1300;
const frameHeight = Math.round(frameWidth * (900 / 1440)) + Math.max(30, Math.round(frameWidth * 0.034));
const screenTop = vertical ? Math.round(v.safe.top + (v.height - v.safe.top - v.safe.bottom - frameHeight) * 0.62) : 186;
```

Why: derive positions from `v.safe` and `v.unit` instead of pixels, and branch on orientation once. The 9:16 layout
stacks the headline above a full-width frame and zooms harder (see the `focus` scales below).

## One headline at a time

```js
function headline(shot, copy, at, out) {
  const h = add(shot.el, `<h2 class="dm-title headline">${copy}</h2>`);
  if (vertical) h.style.bottom = `${v.height - screenTop + 7 * u}px`;
  text.reveal(h, { at, by: "word", stagger: 0.055, duration: 0.8, ease: "expo.out" });
  tl.to(h, { opacity: 0, y: -1.5 * u, duration: 0.4, ease: "power2.in" }, out);
  return h;
}
headline(product, "Every launch, from planning to launched.", 3.6, 8.1); // 4.5 s on screen for 6 words
```

Why: each headline is replaced, never stacked (QA `DM-T05`), holds longer than its reading time (`DM-T01`), enters
with the style's `expo.out` and exits faster with `power2.in`.

## Camera, cursor and typing — all from element ids

```js
const app = screen(v, { capture: "flows/create-project@desktop/board", parent: product.el, device: "browser", width: frameWidth, y: screenTop });
const column = [app.rect("link:q3-launch"), app.rect("link:billing-migration")];
const columnRect = { x: column[0].x, y: column[0].y, width: column[0].width, height: column[1].y + column[1].height - column[0].y };
if (vertical) app.focus("link:q3-launch", { at: 4.8, duration: 1.2, scale: 2.2 });
else app.focus(columnRect, { at: 4.8, duration: 1.2, scale: 1.35 });

const pointer = cursor(v, { style: "mac" });
pointer.moveTo(app, "link:q3-launch", { at: 5.8, duration: 0.8 });
app.highlight("link:q3-launch", { at: 6.6, duration: 1.6, style: "ring" });
pointer.moveTo(app, "link:new-project", { at: 8.9, duration: 0.85 });
pointer.click({ at: 9.85 });
app.swap("flows/create-project@desktop/dialog", { at: 10.0, duration: 0.3, transition: "crossfade" });
typeText(app, "textbox:project-name", "Q4 Launch", { at: 11.45, cps: 14 });
pointer.click({ at: 13.05 });
app.swap("flows/create-project@desktop/created", { at: 13.25, duration: 0.35, transition: "crossfade" });
```

Why: every target is an id from the capture's `elements.json`, so the cursor lands on the real button and QA `DM-G01`
can verify each click. The flow's captured states (`board` → `dialog` → `created`) are swapped in the same frame, so
the click visibly causes the next state. A union of two element rects frames a whole column.

## Transitions and the end card

```js
transition.crossfade(intro, product, { at: 3.1, duration: 0.5 });
transition.crossfade(product, dashboard, { at: 20.1, duration: 0.5 });
const card = add(end.el, `<div class="center end"><div class="end-logo"></div><div class="dm-cta" data-dm-cta>Start free trial</div><p class="url" data-dm-cta>harborly.example</p></div>`);
logo(v, { at: 30.55, variant: "wordmark", parent: card.querySelector(".end-logo") });
```

Why: crossfades overlap the shots (no blank frames, `DM-R02`); the CTA is marked `data-dm-cta` so QA can check it is
inside the safe area and held long enough (`DM-L01`, `DM-P03`).

## Audio

`video.json`:

```json
"audio": {
  "music": { "src": "audio/music.wav", "gain": -14, "beats": "audio/beats.json" },
  "sfx": [
    { "name": "whoosh-short", "at": 3.05, "gain": -16 },
    { "name": "click", "at": 9.85, "gain": -14 },
    { "name": "type-key", "at": 11.45, "gain": -22 },
    { "name": "shimmer", "at": 30.55, "gain": -18 }
  ]
}
```

(The real file has one `type-key` per typed character and a click per cursor click.) `audio music` read
`bpm: 112` from the storyboard and the last shot's start (30.4 s) for the ending hit; `audio mix` normalized to
−16 LUFS.
