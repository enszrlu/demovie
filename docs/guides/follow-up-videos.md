# Make the next video faster

The first video in a project pays for the setup: `init`, the login, the first captures, and an agent getting to know
your product. Later videos reuse all of that.

## What carries over

| Already done | Kept in |
|---|---|
| Brand, glossary, routes | `.demovie/brand/`, `glossary.md`, `routes.json` |
| Login | `.demovie/config.json`, `.demovie/.env`, `.demovie/.auth/` |
| Screenshots and element maps | `.demovie/captures/` (until your UI changes) |
| Earlier videos to learn from | `.demovie/videos/<slug>/` (brief, storyboard, composition) |
| Rendered frames | `.demovie/.cache/frames/` (unchanged frames aren't redrawn) |

## Ask for less

The biggest savings come from a smaller request:

- **A shorter type.** A `teaser` (8–15 s) or a `feature` clip (20–35 s) instead of a 35 s `launch`.
- **One format.** Each extra format is another full check and render.
- **One part of the app.** Name it, so the agent starts from the right captures.

```bash
npx demovie make --type teaser --format 9:16 --about "the QR code pickup"
```

Or, in the session where your agent made the last video:

> Now a 12-second vertical teaser of the QR code pickup, in the same style.

Staying in the same session helps most: the agent already knows your captures, your brand and what worked.

## Refresh only what changed

After you change the UI, recapture just what your changes touched:

```bash
npx demovie capture --changed
```

or one page:

```bash
npx demovie capture --route "/app/qr-code" --viewport mobile
```

`npx demovie status` lists stale captures.

## Iterate cheaply

- **Small edits stay small.** "Hold the second shot longer" or "use our green for the CTA" changes a few lines, and the
  next render only redraws the frames that changed.
- **Look before rendering.** `npx demovie stills launch --at 2,8,15 --sheet` makes a contact sheet in seconds;
  `npx demovie preview launch` lets you scrub.
- **Draft first.** `npx demovie render launch --quality draft --format 16:9` is fast; render `final` once.

## How long things take

On a recent MacBook, for reference:

| Step | Time |
|---|---|
| Capture 18 screens and flow states (app already running) | about 20 s |
| QA on one 35 s video, one format | under a minute |
| Final render of a 35 s video at 1080p | about 1 minute per format |
| A first launch video by an agent, end to end | 20–60 minutes |
| A 12 s teaser in a project that's already set up (Harborly, `make --yes`, Opus 5.5) | 3 min 21 s, $1.06 |

Agent time and cost depend on the model and its effort setting. `make` prints both at the end.

## Keep the disk tidy

Rendered frames are kept so re-renders are fast, and they add up to gigabytes. `npx demovie status` warns when they
pass 2 GB; `npx demovie clean` frees them (the next render redraws what it needs).
