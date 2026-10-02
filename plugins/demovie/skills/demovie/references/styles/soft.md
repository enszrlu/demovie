# Style: soft

Friendly and calm: rounded shapes, gentle springs, soft tinted shadows and light tints of the brand color. For
consumer products, onboarding, community and education.

## Tokens (`packages/runtime/styles/soft.css`)

| Token | Value |
|---|---|
| `--dm-ease-out` | `cubic-bezier(0.34, 1.56, 0.64, 1)` — GSAP `back.out(1.4)` |
| `--dm-duration` | 0.8 s |
| `.dm-title` | 7 units, weight 600, tracking −0.025em |
| `.dm-kicker` | a tinted pill (18% primary tint) |
| `.dm-bg` | a diagonal gradient between a 10% primary tint and the background |
| `.dm-blob` | a blurred tinted circle for soft depth |
| screen frames | 2.4-unit corner radius; primary-tinted shadow |
| `.dm-cta` | fully rounded pill with a soft colored shadow |

## Motion

- Entrances with `back.out(1.2–1.5)`: elements overshoot slightly and settle; 0.6–0.9 s; scale from 0.92–0.96.
- Captures float in (y + scale) and rest; camera moves are slow and short.
- Transitions: crossfades and gentle `push` (0.6–0.8 s).
- Music: `calm` by default, 84–100 BPM.

## Do

- Round everything that you draw (kickers, chips, frames); keep shadows soft and tinted.
- Use 1–2 blobs at most, behind content, never over UI.

## Don't

- Hard cuts, flashes, heavy shadows, sharp corners.
- Springs stronger than `back.out(1.6)` — it reads as cartoonish.

Reference composition: `examples/compositions/soft-launch/` ([annotated](../examples/soft-launch.md)).
