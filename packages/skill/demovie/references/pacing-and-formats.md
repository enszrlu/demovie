# Pacing and formats

## Video types

| Type | Default | Range | Formats | VO | Music | Average shot ≥ |
|---|---|---|---|---|---|---|
| `changelog` | 15 s | 10–20 s | 16:9, 1:1 | off | on | 1.5 s |
| `teaser` | 12 s | 8–15 s | 9:16, 1:1 | off | on | 1.2 s |
| `feature` | 25 s | 20–35 s | 16:9, 9:16 | optional | on | 1.8 s |
| `launch` | 35 s | 25–50 s | 16:9, 9:16 | optional | on | 1.8 s |
| `walkthrough` | 75 s | 60–120 s | 16:9 | recommended | low | 2.5 s |
| `hero-loop` | 10 s | 6–15 s | 16:9, 4:5 | off | none (muted) | 1.8 s; first and last frame differ < 2% (`DM-P05`) |

QA `DM-P02` requires the duration to be in range and equal to `video.json.duration` (± 1 frame). `DM-P01` warns when
the average shot is shorter than the floor above and errors when more than 4 shots in a row are under 0.8 s.

## Reading time

- On-screen text: visible for at least `max(1.2 s, 0.5 s + words / 3)` (QA `DM-T01`).
- At most 2 text blocks and 18 words on screen at once (`DM-T05`).
- VO: at most 2.6 words per second; leave 0.3–0.5 s between lines. Lines must not overlap or run past the end
  (`DM-S02`).
- End card (logo + CTA) held at least 1.5 s (`DM-P03`).

## A launch structure that works (35 s)

| Shot | Time | Purpose |
|---|---|---|
| Title | 0–3.5 s | The product and the one message. |
| Product 1 | 3.5–15 s | The core job, shown in real UI: board, list or dashboard; one camera move, one highlight. |
| Product 2 | 15–24 s | The key interaction as a flow: cursor → click → result. |
| Proof | 24–30 s | The outcome: a result screen, report or real number from the seed data. |
| End | 30–35 s | Logo + CTA + URL, held. |

Changelogs (15 s): what changed (title, 3 s) → the change in the UI (8 s) → where to find it + CTA (4 s).

## Formats

| Format | Stage | Safe area (top/right/bottom/left) | Notes |
|---|---|---|---|
| 16:9 | 1920×1080 | 5% / 5% / 5% / 5% | Desktop captures fit naturally in a browser frame. |
| 9:16 | 1080×1920 | 12% / 6% / 20% / 6% | Keep text out of the bottom 20% (platform UI). Zoom into regions of desktop captures, or capture `--viewport mobile`. |
| 1:1 | 1080×1080 | 6% on all sides | Crop to one region; fewer words. |
| 4:5 | 1080×1350 | 6% / 6% / 8% / 6% | Feed posts; like 1:1 with more vertical room. |

- `v.unit` is 1% of the short side. Size type and spacing in units so layouts scale across formats.
- Minimum text size: 3% of the short side (`3 * v.unit`); captions 3.8%. In CSS: `calc(var(--dm-unit) * 3)`.
- Design each format: in 9:16, stack headline above a narrower screen, or zoom to the element that matters; don't
  shrink a 16:9 layout into a strip.
- `data-format` on `<html>` (`[data-format="9:16"]`) lets CSS switch layouts per format; `v.width > v.height` in JS.
- Captions burn in for `video.json` `captions.burnIn` formats (default `["9:16"]`) whenever there is VO.

## Beat grid

With music, `audio/beats.json` holds every beat and bar. `v.beat(n)` and `v.bar(n)` return seconds; time cuts, reveals
and highlights on them. The synth places a bar line exactly on the start of the final logo shot (the ending hit).
