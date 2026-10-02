# demovie

**Your agent animates. demovie makes it true.**

Accurate, on-brand motion-graphics videos of your real web app — launch videos, feature clips, changelogs, teasers,
walkthroughs and landing-page hero loops — made by the AI coding agent you already use, from real captures of your
running app, checked by a QA engine before they render.

[![Left: a one-prompt video with an imagined dashboard. Right: the same brief made with demovie from real captures.](docs/media/grounded-vs-generic.gif)](docs/media/grounded-vs-generic.mp4)

<sub>Left: one prompt, no captures — an imagined dashboard, invented metrics, HUD labels. Right: demovie — real
captures of the app, the product's own words, a cursor that clicks real buttons. [Watch the MP4](docs/media/grounded-vs-generic.mp4).</sub>

## Quickstart

```bash
npx demovie init        # detect your app; extract brand, glossary and routes; set up demo data, login and the skill
npx demovie capture     # screenshots + element maps of every route and flow
npx demovie make        # start your agent with the demovie skill — or just ask it for a video
```

Requirements: Node ≥ 20.19 (or Bun), ffmpeg with libx264, and an app you can run locally. Next.js is detected
automatically; other apps work with `init --url`. See [getting started](docs/getting-started.md).

## How it works

```mermaid
flowchart LR
  A[Your app] -->|init: detect, extract| B[".demovie/<br/>brand · glossary · routes"]
  A -->|capture: seeded data, frozen clock, redaction| C[Captures<br/>screen.png + element maps]
  B --> D[Your agent + demovie skill]
  C --> D
  D -->|brief · storyboard · composition| E[HTML + GSAP composition<br/>on the demovie runtime]
  E -->|qa: 30 rules| F{0 errors?}
  F -- no: fix hints --> D
  F -- yes --> G[render: MP4 16:9 · 9:16 · posters · captions]
```

1. **Ground.** `init` reads your code and the running app: brand colors and fonts, your product's vocabulary, every
   route. `capture` screenshots real states with seeded demo data, a frozen clock and masked personal data, and maps
   every element (`button:create-project`, `link:q3-launch`).
2. **Direct.** Your agent follows the demovie skill: brief → capture plan → storyboard → style frames → animation. The
   runtime only shows product UI through `screen()` with real captures; cursors, zooms and highlights target element
   ids.
3. **Check.** `demovie qa` samples the video and runs 30 rules — reading time, legibility, contrast, safe areas,
   pacing, truthful clicks, invented words and numbers, determinism, loudness, audio provenance and the "AI look"
   clichés — with a fix for every failure.
4. **Render.** A deterministic frame-stepping renderer (Playwright + your ffmpeg) writes H.264 MP4s in every format,
   posters and captions, with license-clean music and SFX mixed to −16 LUFS.

## Features

- **Real captures, not imagination** — logged-in states via form login, saved sessions or scripts; multi-step flows
  in YAML or TypeScript; stable element maps; freshness tracking.
- **Your brand and your words** — colors, fonts and logos extracted from your code; a glossary that QA enforces.
- **A motion runtime** — device frames, camera moves, a truthful cursor, typing, callouts, captions, transitions; five
  style presets (`clean`, `bold`, `soft`, `editorial`, `terminal`).
- **QA you can trust** — 30 machine-checked rules, a preview player with QA overlays, contact sheets for review.
- **License-clean audio** — a deterministic music synthesizer that follows your storyboard, 12 CC0 sound effects,
  optional voiceover with your own ElevenLabs or OpenAI key, ducking and loudness normalization.
- **Changelog mode** — `demovie changes` maps commits to affected routes through the import graph; a GitHub Action
  makes a clip for every release.

## Works with your agent

| Agent | Skill | MCP | `demovie make` |
|---|---|---|---|
| Claude Code | `.claude/skills/demovie` or the plugin | ✓ | interactive and headless |
| Codex CLI | `.agents/skills/demovie` | ✓ | interactive and headless |
| Cursor | `.agents/skills/demovie` | ✓ (`.cursor/mcp.json`) | interactive and headless |
| Any MCP client or skills-aware agent | `npx skills add enszrlu/demovie` | `npx -y demovie mcp` | `--agent custom --agent-cmd "…"` |

demovie never logs in to AI services or touches your subscriptions: it starts the agent you installed and signed in
to, or passes through API keys in CI. See [agents](docs/agents.md) and [licensing and terms](docs/licensing-and-terms.md).

## Examples

Reference compositions in [`examples/compositions`](examples/compositions), all made from captures of the fictional
[Harborly](examples/harborly) app and all passing QA:

| `clean` | `bold` | `soft` |
|---|---|---|
| ![clean-launch](docs/media/examples/clean-launch.png) | ![bold-launch](docs/media/examples/bold-launch.png) | ![soft-launch](docs/media/examples/soft-launch.png) |
| **`editorial`** | **`terminal`** | |
| ![editorial-launch](docs/media/examples/editorial-launch.png) | ![terminal-launch](docs/media/examples/terminal-launch.png) | |

Made by following the skill on Harborly, the same way your agent would:

| [Launch video](examples/harborly/.demovie/videos/launch) (35 s, 16:9 + 9:16) | [Changelog clip](examples/harborly/.demovie/videos/changelog) (15 s, 16:9 + 1:1) |
|---|---|
| ![Harborly launch video](docs/media/examples/harborly-launch.png) | ![Harborly changelog clip](docs/media/examples/harborly-changelog.png) |

Each folder holds the brief, storyboard, `video.json` and composition. Captures, audio and MP4s are gitignored;
[CONTRIBUTING.md](CONTRIBUTING.md#regenerating-the-examples) shows how to regenerate them.

## FAQ

**Why not just prompt Opus?** A model that has never seen your product redraws a generic dashboard and invents
features, numbers and customers. demovie gives it your real app and checks the result. See the comparison above.

**Why not Remotion?** Remotion is free only for individuals, non-profits and companies of up to three people; larger
companies need a paid license. demovie is MIT. Compositions are plain HTML + GSAP rendered by demovie's own renderer.

**Does it use my Claude subscription?** No. demovie never logs in or reads tokens. Your agent — installed and signed in
by you — uses demovie as a tool; in CI, the action uses API keys you provide.

**Where does my data go?** Nowhere: captures and videos stay in `.demovie/` in your repo, there's no telemetry, and the
only outside calls are the ones you configure (voiceover or music providers, with your key and your approval).

More in the [FAQ](docs/faq.md).

## Docs

[Getting started](docs/getting-started.md) · [Concepts](docs/concepts.md) · [Config](docs/config.md) ·
[Capture and auth](docs/capture-and-auth.md) · [Demo data](docs/demo-data.md) · [Compositions](docs/compositions.md) ·
[Styles](docs/styles.md) · [QA rules](docs/qa-rules.md) · [Audio](docs/audio.md) · [Agents](docs/agents.md) ·
[CI](docs/ci.md) · [Licensing and terms](docs/licensing-and-terms.md) · [Troubleshooting](docs/troubleshooting.md) ·
[FAQ](docs/faq.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md): `pnpm install && pnpm build && pnpm verify`. Please read the
[code of conduct](CODE_OF_CONDUCT.md) and report security issues as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). Bundled fonts are OFL; bundled sound effects are CC0.
