# demovie compared

There are several good ways to make a product video with an AI agent now. This page says where demovie fits, measured
where we could measure, and where another tool is the better choice. Facts about other tools were checked on
2026-10-02; tell us if something here is out of date.

## The short version

- **For a quick, fun launch post** of a React app you just built: [brag](https://github.com/latent-spaces/brag) is one
  command and tells a good story.
- **To build videos as code yourself:** [Remotion](https://www.remotion.dev) (React) or
  [HyperFrames](https://github.com/heygen-com/hyperframes) (HTML). Both have agent skills.
- **For a showreel or motion art** that isn't about your real UI: a strong model with a good prompt and a render
  harness is enough.
- **For a product video that has to show your real, current product:** logged-in screens, your own demo data, several
  formats, checked before it renders, and a fresh clip on every release. That's what demovie is for.

## At a glance

| | demovie | brag | Remotion + skills | HyperFrames + skills | A prompt and a render harness |
|---|---|---|---|---|---|
| **What it is** | Captures + a motion runtime + QA + renderer, driven by your agent | A Claude Code skill: reads your code, writes and renders a launch video | React framework for video | HTML framework for video, built for agents | Your agent writes a `seek(t)` page and renders it frame by frame |
| **Where the product UI comes from** | Screenshots of your running app, with element maps | Your real components rendered outside the app, or your live site | Whatever you bring | Whatever you bring | What the agent finds: often your marketing site |
| **Data on screen** | Your demo data | Your demo data when it can load it outside the app; otherwise sample data the agent writes | Yours | Yours | Whatever it finds |
| **Pages behind a login** | Built in: form, recorded session, script, several roles | Not in its docs | Up to you | Up to you | Up to you |
| **Personal data on screen** | Masked before each screenshot | Not in its docs | Up to you | Up to you | Up to you |
| **Checks before rendering** | 30 QA rules: legibility, contrast, timing, safe areas, invented words and numbers, loudness | The agent's judgment (plus HyperFrames' linter in its full mode) | Your review | `hyperframes check` | The agent's self-critique |
| **Formats** | 16:9, 9:16, 1:1, 4:5, each designed separately | One per run: landscape, vertical or square | Any you build | Any you build | Any it builds |
| **A video per release** | GitHub Action: what changed → recapture those pages → a clip | Not in its docs | Build it yourself | Build it yourself | Build it yourself |
| **Getting started** | `init` and `capture` (minutes) | One command | A project to set up | An install | A rules file and a script |
| **License** | MIT | MIT | Remotion's own license: free for individuals and companies of up to 3 people, paid above that | Apache-2.0 | — |

## Measured: four approaches on one real app

We made a launch video of a private, production Next.js app (several user roles behind a login) four ways, each in
a clean copy of the app. All the agent runs used Claude Opus 5.5 at maximum effort.

| Approach | Length · formats | Agent time | Cost reported by Claude Code | What the product looked like |
|---|---|---|---|---|
| demovie | 35 s · 16:9, 9:16 | not comparable (made while demovie itself was being finished) | — | Sharp screens of the running app with its demo data, in the current design |
| brag, default options | 22 s · 16:9 | 59 min, plus one nudge to finish | $24.24 | The real components, crisp and current, but filled with sample data the agent invented |
| The "motion design studio" course harness | 20 s · 9:16, 1:1, 16:9 | 86 min | $31.39 | Cropped from the marketing site's video: soft, and in an older design |
| A one-line showreel prompt | 15 s · 16:9 | 67 min | $12.05 | None: the reel was about the model, as the prompt asked |

What we took from it:

- **brag told the best story** (a joke from the landing page as the hook, three clear steps) and **the course harness
  had the most energy** (big kinetic type on the beat). demovie's video was the calmest. Since then, demovie's skill
  plans the angle and a kinetic hook first.
- **Only demovie showed the product as it really is today.** The others showed invented data, or an old design taken
  from a marketing video. That matters for a sales page or a changelog, less for a fun post.
- **Every run spent most of its time getting at the product's UI.** brag built a component harness from scratch; the
  course harness hunted for footage. demovie keeps its captures, so the next video starts from them.
- **No agent could hear its soundtrack.** All of them mixed by measurement. Listen before posting, whichever you use.

## The same app, side by side

Our example app, Harborly, made with one command each: `/brag` with its defaults, and
`npx demovie make --type teaser --format 16:9 --yes`.

[![Left: brag's video of Harborly. Right: demovie's teaser of Harborly.](media/comparison/harborly-brag-vs-demovie.gif)](media/comparison/harborly-brag-vs-demovie.mp4)

| | brag | demovie |
|---|---|---|
| Starting point | The repository, nothing set up | `init` and `capture` already done (a few minutes, once per project) |
| Agent time · turns · reported cost | 39 min · 108 turns · $12.26 | 3 min 21 s · 43 turns · $1.06 |
| The video | 21.5 s, 16:9, music and sound effects | 12 s, 16:9, music |
| The product on screen | Harborly's real components and demo data, rendered in a harness it built for the run | Screenshots of the running app with its demo data |
| Checked by | Its own review of its frames | QA: 0 errors, 0 warnings |

Both runs used Claude Opus 5.5, brag at maximum effort and demovie at the default effort, so read the cost difference
as a direction, not a precise ratio. Harborly keeps its demo data in a local file, so brag could load it; on the
private app above, whose data sits behind a database, it wrote sample data instead. brag's story is the stronger one
here; demovie's run was the cheap part of a project that was already set up.

## When another tool is the better choice

- **You just want to share something you built, today.** brag is one command and needs no setup. demovie asks you to
  run `init` and set up a login and demo data first.
- **You're building a video product, or hundreds of data-driven videos.** Remotion and HyperFrames are frameworks for
  exactly that.
- **The video isn't about your UI** (a brand film, a showreel). You don't need captures; any capable agent and a render
  harness will do.
- **You want a quick, authentic walkthrough.** A screen recorder with auto-zoom is faster than any of these.

## What demovie doesn't do (yet)

- It needs an app it can run (locally, or a preview URL), and some setup for logins and demo data.
- It only knows web apps. Native mobile and desktop apps aren't supported.
- Voiceover is off by default; it needs your own ElevenLabs or OpenAI key.
- Windows is untested; macOS and Linux are.
