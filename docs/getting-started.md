# Getting started

demovie gives your coding agent what it needs to make accurate, on-brand motion-graphics videos of **your real web
app**: real screenshots and element maps of the running app, a motion runtime, a QA engine and a renderer. Your agent
does the creative work; demovie keeps it true.

## Requirements

- Node.js ≥ 20.19 (22 LTS recommended) — or Bun for `bunx demovie`.
- ffmpeg with libx264 on your PATH (`brew install ffmpeg`, `sudo apt-get install -y ffmpeg`, `winget install ffmpeg`).
- Chromium for Playwright: `npx demovie doctor --fix` installs it.
- A web app you can run locally (Next.js is detected automatically; anything else works in generic mode with `--url`).
- An AI coding agent you already use and are signed in to: Claude Code, Codex CLI, Cursor, or any agent that reads
  Agent Skills or speaks MCP.

## Quickstart

```bash
npx demovie init            # detect the app, extract brand + glossary + routes, set up demo mode and login, install the skill
npx demovie capture         # screenshot every route and flow with element maps
npx demovie make            # launch your agent with the demovie skill (or just ask your agent for a video)
```

`init` asks a few questions (how to start the app, how to log in, which agents you use) and writes `.demovie/`:

```
.demovie/
├─ config.json          # how to run, seed and log in to the app (secrets only as $env: references)
├─ brand/brand.json     # colors, fonts, logo — extracted from your code and the running app
├─ glossary.md          # your product's vocabulary (edit it; `glossary sync` rebuilds glossary.json)
├─ routes.json          # every route, with protected flags
├─ flows/               # user journeys to capture (create-project.flow.yaml, …)
├─ captures/            # screenshots + element maps (gitignored)
└─ videos/<slug>/       # brief.md, storyboard.md, video.json, composition/, audio/, out/
```

Then talk to your agent in plain words — "make a 30-second launch video of the Projects board" — and it follows the
skill: brief → captures → storyboard → style frames → animation → QA → render. Or run `npx demovie make --type launch
--about "the Projects board"` to start your agent with that request.

## What you get

`.demovie/videos/<slug>/out/` holds `<slug>-16x9.mp4`, `<slug>-9x16.mp4` (H.264, yuv420p, BT.709, AAC), posters,
captions when there is a voiceover, and optionally a GIF and a WebM. `qa.json` next to it records every QA rule's
result.

## Next

- [Your first video, step by step](tutorial.md): the same three commands, with what you should see at each step.
- [Recipes](recipes.md) and the [command reference](cli.md).
- [How demovie compares](comparison.md) with brag, Remotion, HyperFrames and plain prompting.
- [Concepts](concepts.md): grounding levels, captures, compositions, QA.
- [Capture and auth](capture-and-auth.md) and [demo data](demo-data.md).
- [Agents](agents.md): Claude Code, Codex, Cursor, MCP and `make`.
- [CI](ci.md): a changelog clip for every release.
