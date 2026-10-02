# Style: editorial

Magazine-like and confident: large display type (a serif if the brand has one), slow 1.0–1.4 s moves and generous
whitespace. For narrative launches, announcements and brand pieces.

## Tokens (`packages/runtime/styles/editorial.css`)

| Token | Value |
|---|---|
| `--dm-ease-out` | `cubic-bezier(0.25, 1, 0.5, 1)` — GSAP `quart.out`, used slowly |
| `--dm-duration` | 1.2 s (use 1.0–1.4 s) |
| `.dm-title` | 8.6 units, weight 500, tracking −0.04em, line-height 1 |
| `.dm-subtitle` | 3.6 units, max 28ch, generous leading |
| `.dm-kicker` | a small label over a hairline rule |
| `.dm-bg` | a warm paper tint of the background |
| `.dm-cta` | underlined text link in the brand primary (no button) |

## Motion

- Slow reveals by line (1.0–1.4 s, `quart.out`), long holds, few elements per frame.
- Asymmetric layouts: big type left-aligned with a capture offset to the right (16:9), stacked in 9:16.
- Camera drifts rather than pushes; crossfades of 0.8–1.0 s.
- Music: `minimal` by default, 88–104 BPM.

## Do

- Let whitespace do the work; one idea per frame.
- Use hairline rules and small kickers to structure, the brand font at display sizes.

## Don't

- Quick cuts, bouncy easing, crowded frames, more than one type family plus its mono.

Reference composition: `examples/compositions/editorial-launch/` ([annotated](../examples/editorial-launch.md)).
