# Style: terminal

A developer-tool feel: mono type, code and CLI-style reveals, grid backgrounds. For dev tools, APIs, CLIs and
infrastructure products.

## Tokens (`packages/runtime/styles/terminal.css`)

| Token | Value |
|---|---|
| `--dm-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` — GSAP `quart.out` |
| `--dm-duration` | 0.5 s |
| `.dm-title` | 6.4 units, weight 600, the brand's mono font |
| `.dm-subtitle` | 3.2 units, mono, 70% terminal foreground |
| `.dm-bg` | a dark terminal background (foreground mixed with primary) with a 6-unit grid |
| `.dm-prompt` | prefixes `$ ` in the primary color |
| `.dm-cta` | outlined mono button |

## Motion

- Type text like a terminal: `text.reveal(el, { by: "char", stagger: 0.03 })` or line by line, with a blinking-free
  caret (no timers; draw it from the timeline).
- Snappy entrances (0.4–0.6 s, `quart.out`); captures slide in on the grid and stay aligned to it.
- Transitions: quick crossfades, `wipe` along the grid; occasional hard cut on a command "enter".
- Music: `tech` by default, 112–124 BPM.

## Do

- Use real commands and real UI text only (no fake logs or output — that is invented UI).
- Keep the grid subtle; align captures and text to it.

## Don't

- Matrix rain, glitch effects, green-on-black clichés, fake code that isn't the product's.

Reference composition: `examples/compositions/terminal-launch/` ([annotated](../examples/terminal-launch.md)).
