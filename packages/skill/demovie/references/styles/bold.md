# Style: bold

Kinetic and loud: huge type at 10–16% of the frame height on brand-primary backgrounds, hard cuts on the beat. For
teasers, launches with energy, social cutdowns.

## Tokens (`packages/runtime/styles/bold.css`)

| Token | Value |
|---|---|
| `--dm-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` — GSAP `quart.out` / `power4.out` |
| `--dm-duration` | 0.45 s (use 0.3–0.5 s) |
| `.dm-title` | 12% of the frame height (13% of the width in 9:16/4:5), weight 800, tracking −0.045em, primary-foreground on primary |
| `.dm-subtitle` | 4 units, weight 600 |
| `.dm-bg` | solid brand primary; `.dm-bg--ink` for the foreground color |
| `.dm-cta` | inverted pill (primary-foreground background, primary text), weight 800 |

## Motion

- Words slam in (`power4.out`, 0.3–0.45 s, from below or scaled 1.2→1), one or two words per beat.
- **Cuts land on the beat**: time shot changes and reveals with `v.beat(n)` / `v.bar(n)` from `audio/beats.json`.
- Product shots still come from real captures: show them big, tilted slightly (`tilt`), with fast pushes into one element.
- Transitions: hard cuts and `colorFlash` (brand color) on downbeats; `push` for momentum.
- Music: `energetic` by default, 120–132 BPM.

## Do

- Few words, very large; each word on screen long enough to read (QA `DM-T01` still applies).
- Alternate primary and ink backgrounds to mark sections.

## Don't

- Cut faster than the reading time, or more than 4 shots in a row under 0.8 s (QA `DM-P01` error).
- Neon, glitch effects, emoji, or colors outside the brand.

Reference composition: `examples/compositions/bold-launch/` ([annotated](../examples/bold-launch.md)).
