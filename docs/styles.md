# Styles

A style preset is a token sheet (`packages/runtime/styles/<name>.css`), guidance for agents
(`packages/skill/demovie/references/styles/<name>.md`) and a reference composition
(`examples/compositions/<name>-launch/`) that passes QA. Pick one in `video.json` (`"style"`) or with
`demovie new --style`. Brand colors and fonts always come from `brand.json`; the style decides type scale, easing,
backgrounds and pacing.

| Style | Feel | Motion | Default music |
|---|---|---|---|
| `clean` | Neutral background, one accent, product UI as the hero (Linear/Vercel-like). | `expo.out`, 0.5–0.9 s, gentle camera pushes, crossfades. | uplifting |
| `bold` | Kinetic type at 10–16% of the frame height on brand-primary backgrounds. | Hard cuts on the beat, punch-in camera cuts, fast settles. | energetic |
| `soft` | Rounded shapes, tints of the brand color, soft shadows. | Gentle springs (`back.out(1.2–1.5)`), floating captures. | calm |
| `editorial` | Large display type, generous whitespace, warm paper tint. | Slow 1.0–1.4 s moves, long holds, drifting camera. | minimal |
| `terminal` | Dev-tool feel: mono type, grid background, CLI-style reveals. | Snappy 0.4–0.6 s entrances, typed text, wipes along the grid. | tech |

Every style shares the CSS variables `--dm-bg`, `--dm-fg`, `--dm-primary`, `--dm-primary-fg`, `--dm-muted-fg`,
`--dm-font-heading`, `--dm-font-body`, `--dm-font-mono`, `--dm-unit` (1% of the short side), `--dm-w`, `--dm-h` and
the safe-area insets `--dm-safe-top|right|bottom|left`, plus the classes `.dm-bg`, `.dm-title`, `.dm-subtitle`,
`.dm-kicker`, `.dm-accent` and `.dm-cta`. When `brand.json` lists chart colors (often darker and lighter tints of the
primary), they are `--dm-chart-1` … `--dm-chart-5`: useful when the primary itself is too light for a CTA's contrast.
