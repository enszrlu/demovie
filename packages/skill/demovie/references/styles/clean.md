# Style: clean

Restrained and precise, in the manner of Linear or Vercel launch videos: a neutral brand background, one accent
color, product UI as the hero, subtle depth.

## Tokens (`packages/runtime/styles/clean.css`)

| Token | Value |
|---|---|
| `--dm-ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` — GSAP `expo.out` |
| `--dm-duration` | 0.7 s (use 0.5–0.9 s) |
| `.dm-title` | 7.2 units, weight 650, tracking −0.035em, heading font |
| `.dm-subtitle` | 3.4 units, weight 450, muted foreground |
| `.dm-kicker` | 3 units, weight 600, primary color |
| `.dm-bg` | brand background with a 7% primary radial wash from the top |
| `.dm-cta` | primary pill-ish button (brand radius) |
| screen shadow | two soft, long shadows (subtle depth) |

## Motion

- Entrances: `expo.out`, 0.5–0.9 s, small travel (1–2 units of `y`), word reveals with 0.05–0.07 s stagger.
- Camera: gentle push-ins on captures (`focus` scale 1.3–1.6), 0.9–1.4 s, `power2.inOut`; return with `reset`.
- Transitions: crossfades of 0.4–0.6 s; no flashes.
- Music: `uplifting` by default, 100–120 BPM.

## Do

- One headline at a time above the screen; let the UI carry the story.
- Use the accent color only for the thing that matters (a highlight ring, the CTA).
- Generous margins: everything inside the safe area with air around it.

## Don't

- Gradients beyond the faint wash, glows, more than one accent, busy backgrounds.
- Fast, bouncy or linear moves.

Reference composition: `examples/compositions/clean-launch/` ([annotated](../examples/clean-launch.md)).
