# Storyboard template

`storyboard.md` is a frontmatter `bpm` plus one table row per shot. `demovie audio music` reads the `bpm` and uses
the first and last shots to shape the music (intro, build, main, outro, ending hit on the final shot);
`demovie audio voice` reads the VO column verbatim.

```markdown
---
bpm: 112
---

| # | start | dur | kind | visual | on-screen text | VO line | captures / element ids | transition | notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.0 | 3.4 | title | Logo mark, title rises word by word | Meet the Projects board | | brand/logo-mark.svg | crossfade 0.5 | expo.out |
| 2 | 3.4 | 17.0 | product | Board in a browser frame; push in on In progress, cursor to Q3 Launch (ring) | Every launch, from planning to launched. | | flows/create-project@desktop/board#link:q3-launch | crossfade 0.5 | one headline at a time |
| 3 | 20.4 | 6.0 | product | Dashboard; camera drifts to the Velocity chart | Then measure velocity, week by week. | | routes/app@desktop#generic:velocity-chart | crossfade 0.5 | |
| 4 | 26.4 | 4.0 | text | Tagline, centered | Plan, ship and measure every launch. | | glossary tagline | crossfade 0.5 | |
| 5 | 30.4 | 4.6 | logo | Wordmark, CTA button, URL | Start free trial · harborly.example | | brand/logo.svg | — | end hold 4.6 s |
```

Columns:

- **start / dur** in seconds. Shots cover the whole video with no gap over 0.5 s (QA `DM-P04`). With music, put
  starts on beats (`beats.json`).
- **kind**: `product` (must contain a `screen()` with a real capture — QA `DM-G03`), `title`, `text`, `logo`, `other`.
- **on-screen text**: the exact words. Separate successive headlines in one shot with ` / `. Every term must exist in
  the glossary, the brief or the captured UI.
- **VO line**: the exact words to speak (≤ 2.6 words/s over the shot), or empty.
- **captures / element ids**: `capture-id#element-id`, separated by `;` or `,`. These are the only valid targets for
  cursor, focus, highlight and callout.
- **transition** into the next shot: `crossfade 0.5`, `push left 0.6`, `wipe up 0.5`, `zoomThrough 0.7`,
  `colorFlash 0.3`, `cut`.
- **notes**: easing, holds, anything the animator needs.
