# Your first video, step by step

This walks you from an app on your laptop to a finished launch video. Your part takes about 10 minutes; then your
coding agent works on the video (20–60 minutes for a first launch video, less for shorter ones).

> **No app at hand?** Follow along with Harborly, the example app in this repository. Clone it, run
> `corepack enable && pnpm install` at the root, and work in `examples/harborly`. It is already set up, so skip step 1;
> its demo login is `DEMOVIE_USER=demo@harborly.demo` and `DEMOVIE_PASSWORD=harborly-demo` (export both).

## Before you start

You need:

- **Node.js 20.19 or newer** (22 LTS recommended).
- **ffmpeg** with libx264: `brew install ffmpeg` on macOS, `sudo apt-get install -y ffmpeg` on Debian or Ubuntu.
- **A web app you can run locally.** Next.js is detected automatically; anything else works by pointing demovie at its
  URL.
- **A coding agent you already use and are signed in to:** Claude Code, Codex CLI or Cursor. demovie never asks for
  your AI account.

Check everything, and install the browser demovie uses for screenshots:

```bash
npx demovie doctor --fix
```

You should see a ✓ for Node, ffmpeg, ffprobe and Chromium. Anything else comes with a `fix:` line telling you what to
run.

## 1. Set up demovie in your app

In your app's folder (the one with `package.json`):

```bash
npx demovie init
```

It detects your framework and asks a few questions:

1. **How the app starts** (for example `npm run dev`) and the URL it answers on.
2. **Whether it needs a login.** If so: the login page, and a test account. The password goes to
   `.demovie/.env`, which is gitignored. Use a demo account, never a real one.
3. **A demo data command** (optional), such as `npm run db:seed`, so screenshots show realistic data instead of empty
   states.
4. **Which agents you use**, to install the demovie skill for them.

It then writes a `.demovie/` folder. Two files are worth a look now:

- `.demovie/glossary.md`: your product's vocabulary (product name, features, labels). Videos may only use these
  words and the ones on your screens, so add anything important that's missing.
- `.demovie/brand/brand.json`: the colors, fonts and logo demovie found in your code.

Not Next.js? Point demovie at your running app instead: `npx demovie init --url http://localhost:5173`.

## 2. Check the app starts

```bash
npx demovie up
```

This loads demo data, starts your app and waits until it answers. If your app needs a login, check it works:

```bash
npx demovie auth test
```

`npx demovie down` stops the app again. Problems? The app's output is in `.demovie/.cache/app.log`, and
[troubleshooting](troubleshooting.md) covers the common ones.

## 3. Capture your screens

```bash
npx demovie capture
```

demovie opens every page (and every flow you defined) in a real browser, with the clock frozen and personal data
masked, and saves a screenshot plus an **element map**: where every button, heading and label is.

```
◇ captured routes/app-projects@desktop (2.6s)
◇ captured routes/app@desktop (3.0s)
…
captured 18 state(s) in 18.5s · flows: create-project@desktop (6 states)
```

Open a few `screen.png` files under `.demovie/captures/`. What you see there is exactly what can appear in your video.
Planning a vertical video? Capture the pages on a phone too:

```bash
npx demovie capture --route "/app/projects" --viewport mobile
```

States behind clicks (a dialog, a filled form) are captured with [flows](guides/capture-flows.md).

## 4. Ask for the video

**Option A: just ask your agent.** In Claude Code, Codex or Cursor, opened in your app's folder:

> Make a 30-second launch video of the Projects board with demovie.

The agent follows the demovie skill: it writes a brief (the angle, the hook and the three moments to show), picks the
captures, plans the shots on a beat grid, builds the animation, looks at its own frames, runs QA and renders. In an
interactive session it shows you the brief and the storyboard before animating.

**Option B: let demovie start your agent.**

```bash
npx demovie make --about "the Projects board"
```

`make` finds your agent, installs the skill if needed and hands it the same request. Add `--no-review` to skip the
review stop, or `--yes` to run without prompts. Without a terminal (or with `--yes`), it prints one line per step and
ends with a summary:

```
[ 2m 15s] → Bash npx demovie stills projects-board-teaser --every 1 --format all --sheet
[ 2m 31s] Legible, on-brand, one focal point per moment. Small polish: start the hook at t=0 so the first frame isn't blank, then re-QA and render.
[ 3m 11s] Rendered. Writing the share copy.
Claude Code finished · 3m 21s · 43 turns · $1.06 (as reported by Claude Code)
videos: .demovie/videos/projects-board-teaser/out/projects-board-teaser-16x9.mp4
```

That was a 12-second teaser in a project that was already set up and captured (`--type teaser --format 16:9`). A
first launch video, with the setup, takes longer.

Video types and their usual length: `launch` (25–50 s), `feature` (20–35 s), `changelog` (10–20 s), `teaser`
(8–15 s), `walkthrough` (60–120 s), `hero-loop` (6–15 s, silent, seamless).

## 5. Watch it, check it, render it

Your agent does these for you, but they're good to know:

```bash
npx demovie preview launch     # a player in your browser: scrub, safe areas, QA overlay
npx demovie qa launch          # 30 checks: legibility, contrast, timing, invented words, loudness…
npx demovie render launch      # final MP4s
```

```
.demovie/videos/launch/out/launch-16x9.mp4 · 1920×1080 · 30 fps · 35.00 s · 5.9 MB · libx264 · 63.5 s
.demovie/videos/launch/out/launch-9x16.mp4 · 1080×1920 · 30 fps · 35.00 s · 4.5 MB · libx264 · 73.7 s
```

## 6. Share it

Everything is in `.demovie/videos/launch/out/`: the MP4s, a poster image per format, and `share.md` with ready-to-post
copy for X and LinkedIn and a changelog blurb.

The music is synthesized for your video, so it's yours to use. Listen before posting anyway: no agent can hear what it
mixed.

## Where to next

- [Make the next video faster](guides/follow-up-videos.md): shorter types, one format, re-capturing one page.
- [Apps with a login](guides/apps-with-login.md): test accounts, several roles, OAuth and 2FA.
- [A video for every release](guides/changelog-every-release.md) with the GitHub Action.
- [Build a video by hand](guides/without-an-agent.md), if you'd rather write the animation yourself.
- [Recipes](recipes.md) for quick answers, and the [command reference](cli.md).
