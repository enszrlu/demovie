# Motion principles

Good product motion is legible first and impressive second. Every move should answer "where should the viewer look
now?" — never "what else can move?".

## Easing

- **No linear moves** for anything the eye follows. Use ease-out for entrances (`expo.out`, `power4.out`,
  `quart.out`), ease-in for exits (`power2.in`), ease-in-out for camera moves between two points (`power2.inOut`,
  `power3.inOut`).
- The style preset sets the house curve as `--dm-ease-out` and a base duration `--dm-duration` (see `styles/`).
  Match GSAP eases to it: clean → `expo.out` 0.5–0.9 s; bold → `power4.out` 0.3–0.5 s; soft → `back.out(1.2–1.5)`;
  editorial → `quart.out` 1.0–1.4 s; terminal → `power3.out` 0.4–0.6 s plus stepped typing.
- Exits are faster than entrances (about 60%). Things leave quietly.

## One focal point per moment

- Stage at most one moving hero at a time; let secondary elements settle before the next move starts.
- Stagger groups (`text.reveal` with `stagger: 0.04–0.08`) instead of moving everything at once.
- Dim or push back what is no longer important (`highlight(…, { style: "dim-others" })`, a slight scale-down, a
  crossfade) instead of adding more on top.

## Camera on captures

- `screen.focus(elementId | rect, { at, duration, scale, padding })` zooms and pans to real elements; `reset()` returns.
  Keep `scale` ≤ 1.5× of the capture's native density (QA `DM-G05` warns above 1.0×, errors above 1.5×); capture at
  `deviceScaleFactor: 2` so zooms stay crisp.
- Move the camera for a reason: to read a label, to follow the cursor, to reveal a result. Hold 1–2 s after arriving.
- Don't fight the cursor: when the cursor travels, keep the camera still or move both with the same easing.
- Consistent direction: if the story moves left-to-right, pushes and slides go left-to-right throughout.

## Cursor

- `cursor.moveTo(screen, id, { at, duration })` draws a natural curved path; 0.6–0.9 s per move reads well.
- Click only on interactive elements, after the cursor has arrived (`click.at ≥ moveTo.at + duration`). QA `DM-G01`
  checks every click lands inside its element under the current camera.
- Hide the cursor when it has nothing to do (`hide({ at })`).

## Text

- Reveal by word for headlines, by line for paragraphs, by char only for very short labels or terminal typing.
- Hold every text block for its reading time (`max(1.2 s, 0.5 s + words / 3)`) after it is fully visible.
- Big, short, specific. One idea per line. Use the product's words (glossary), never filler.

## Transitions

- Prefer continuity: crossfades (0.4–0.6 s) between related shots, push/wipe when the subject changes, a
  `zoomThrough` into a real element when it leads into the next shot, `colorFlash` sparingly (bold style).
- Overlap shots with a transition instead of leaving blank frames (QA `DM-R02` flags frames that are > 98% one color
  for more than 0.3 s outside transitions).
- Hard cuts belong on the beat (`v.beat(n)`), and only in styles that call for them (`bold`).

## Determinism (required)

The renderer seeks frames in any order. Everything must be a pure function of `t`:

- Tweens on `v.timeline` (helpers do this for you). No free-running GSAP tweens (QA `DM-R03`).
- CSS animations only through `v.css(el, keyframes, { start, duration })` (QA `DM-R04`).
- No `setTimeout`/`setInterval` after `ready()` (QA `DM-R05`), no `Date.now()`, no `Math.random()` — use
  `v.random(seed)`.
- Canvas/WebGL: draw in `v.onSeek(t => …)` from `t` alone.
