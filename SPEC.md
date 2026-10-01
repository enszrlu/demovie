# demovie — Specification v1.0

> Build spec for an autonomous coding agent. Read it fully before writing code.
> Sections are referenced as §N. MUST / SHOULD / MAY follow RFC 2119.
> Last updated 2026-09-28. Companion files: `AGENTS.md` (how to work), `PROGRESS.md` (checklist), `DECISIONS.md` (decision log), `GOAL.md` (the `/goal` prompt).

---

## 0. Summary

**demovie** is an open-source (MIT) toolkit that lets any AI coding agent produce **accurate, on-brand motion-graphics videos of a real web product**.

Frontier coding agents (Claude Code with Opus 5.5, Codex, Cursor) already animate well from a single prompt. They fail at what matters for a product video:

- They redraw UI from memory and invent users, numbers and product vocabulary.
- They can't see the product behind a login or with realistic data.
- They cut too fast to read, and every video converges on the same "AI look".
- They have no finishing pipeline: multi-aspect output, voice, captions, loudness, QA.
- They are one-shot: nothing makes the next video for the next release.

demovie fixes these with **deterministic tools the agent calls** plus an **Agent Skill that encodes the craft**:

1. **Product kit.** Brand tokens, fonts, logo, glossary and route map, extracted from the repo and the running app.
2. **Capture.** Boots the app in a seeded demo mode, logs in, and captures pixel-perfect screens and user flows with exact element coordinates.
3. **Runtime.** A small browser library for HTML compositions: deterministic time, device frames, camera moves to real elements, a truthful cursor, captions and transitions.
4. **Renderer.** Deterministic frame-by-frame HTML → MP4 in 16:9, 9:16, 1:1 and 4:5, with audio mixing and loudness normalization.
5. **QA.** Machine-checked rules for legibility, pacing, layout, truth and audio. The agent must pass them.
6. **Audio.** License-clean synthesized music and SFX, plus optional voiceover (the user's own key) with word-timed captions.
7. **Agent layer.** An Agent Skill, a Claude Code plugin, an MCP server, and `demovie make`, which launches the user's own agent CLI.
8. **Release clips.** `demovie changes` plus a GitHub Action that produces a clip per release from a preview deployment.

First-class support: Next.js (App Router and Pages Router). Fallback: any reachable URL ("generic" mode).

Tagline: **"Your agent animates. demovie makes it true."**

---

## 1. Goals, principles, non-goals

### 1.1 Goals (v1.0)
- **G1.** A Next.js developer goes from `npx demovie init` to a QA-passing 30 s launch video of their real, logged-in app within one agent session, with no manual video editing.
- **G2.** Every pixel of product UI in a video comes from a real capture (§9). Stylized non-UI graphics (type, shapes, backgrounds) are allowed.
- **G3.** Rendering is deterministic: the same composition, captures and assets produce identical frames on the same machine.
- **G4.** Agent-agnostic: works with any agent that supports Agent Skills or MCP. Claude Code, Codex and Cursor are first-class.
- **G5.** A clip per release in CI, via a GitHub Action.
- **G6.** Trust: MIT license, no telemetry, no account, local-first, and license-clean dependencies and audio.

### 1.2 Principles
- **Truth over imagination.** Use real captures, real vocabulary, and seeded demo data (fictional but plausible). Never invent metrics.
- **Tools, not prompts.** Anything deterministic lives in the CLI. The agent makes the creative decisions.
- **Legible beats flashy.** Pacing floors are enforced, not suggested.
- **Don't box the agent in.** Compositions are plain HTML/CSS/JS plus GSAP. The runtime helps without constraining: any DOM or canvas code is allowed if it follows the time contract (§10.1).
- **Agent-first I/O.** Every command supports `--json`, and every error says how to fix it.
- **Local-first and private.** Nothing leaves the machine except calls the user configures, such as a TTS provider with their own key.
- **Boring, license-clean dependencies** (§5.4).

### 1.3 Non-goals (v1)
- A hosted SaaS, cloud rendering, accounts or billing.
- A GUI timeline editor. Only a preview/scrub player (§11.7).
- Avatars, generated footage (Veo, Sora, etc.) and stock footage.
- **Remotion.** It MUST NOT be a dependency. Its license charges per seat for companies with 4+ people and restricts rendering services.
- Handling any AI vendor's credentials, OAuth or subscription tokens (§14.5).
- Native mobile or desktop apps, and other non-web products.
- Localized videos (P2).
- Windows as a first-class platform. Best effort only; macOS and Linux are required.

---

## 2. Users and jobs

**Personas**
- **Solo or indie SaaS founder.** Next.js on Vercel, Supabase or similar. Ships weekly. No motion designer.
- **Startup product team.** Wants a clip for every release and a launch video for each big feature.
- **DevRel or marketing at a dev-tool company.** Needs consistent on-brand videos.

**Video types** (presets in §11.3): `launch`, `feature`, `changelog`, `teaser`, `walkthrough`, `hero-loop`.

---

## 3. User experience

### 3.1 Quickstart
```bash
npx demovie init       # detect the app, extract brand/glossary/routes, set up demo mode + login, install the agent skill
npx demovie capture    # start the app in demo mode, log in, capture real screens + element maps
```
Then, in the user's agent (Claude Code shown; others work the same way):
```
/demovie make a 30s launch video for the new Projects board
```

### 3.2 `init` interactive session (target UX)
```
$ npx demovie init
┌  demovie
◇  Detected Next.js 16.x (App Router, src/app) · pnpm · Tailwind v4 · shadcn/ui
◇  Start command › pnpm dev   (port 3000)
◇  Your app is running at http://localhost:3000 ✓
◇  Does the product need a login? › Yes — email + password form
◇  Test user email / password › stored in .demovie/.env (gitignored)
◇  Demo data seed command (optional) › pnpm demo:seed
◇  Agents you use › Claude Code, Codex, Cursor
◆  Extracting…
│  brand: 7 colors · 2 fonts (Geist, Geist Mono) · logo.svg
│  routes: 14 (9 behind login) · glossary: 31 terms
│  skill → .claude/skills/demovie, .agents/skills/demovie · MCP → .cursor/mcp.json
└  Next: `npx demovie capture`, then ask your agent: "/demovie make a 30s launch video"
```

### 3.3 Headless orchestration (`demovie make`)
A convenience wrapper that launches the user's **own** agent CLI (§14.4):
```
$ npx demovie make
◇  Agent › Claude Code (installed) · Codex (installed) · Cursor CLI (not found)
◇  Model › agent default · claude-opus-5-5 (recommended) · other…
◇  Video type › launch     ◇ Length › 35s     ◇ Formats › 16:9, 9:16
◇  What is it about? › The new Projects board
◇  Resources (optional) › ./launch-script.mdx ./assets/hero.png
◇  Voiceover › off (no TTS key found)     ◇ Review storyboard first › yes
→ launches: claude "<generated prompt that uses the demovie skill>"
```
Non-interactive form:
```bash
npx demovie make --agent claude --type launch --duration 35 --format 16:9,9:16 --about "New Projects board" --resources launch-script.mdx --yes
```

### 3.4 CI
A GitHub Action produces a changelog clip for each release (§15).

---

## 4. Architecture

```
┌──────────────────── the user's agent (Claude Code / Codex / Cursor / …) ────────────────────┐
│  loads the Agent Skill "demovie"  ──calls──▶  demovie CLI (--json)   or   MCP tools         │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                             │
┌────────── core ───────────┐  ┌──────── capture ────────┐  ┌──────── render ─────────┐  ┌── qa ───┐
│ config & schemas (zod)    │  │ app lifecycle + seed    │  │ static server + sandbox │  │ rules   │
│ detection (Next/generic)  │  │ auth strategies         │  │ frame stepping (CDP)    │  │ engine  │
│ brand / glossary / routes │  │ routes & flows          │  │ ffmpeg encode + mux     │  └─────────┘
│ changes (git → routes)    │  │ element maps, redaction │  │ stills, contact sheets  │
└───────────────────────────┘  └─────────────────────────┘  │ preview server          │
                                                            └─────────────────────────┘
┌─────── runtime (browser) ───────┐  ┌──────── audio ────────┐  ┌──── agent layer ──────┐
│ deterministic clock, stage,     │  │ music synth, SFX set, │  │ SKILL.md + references │
│ screen/cursor/captions/…, GSAP  │  │ TTS providers, mixing │  │ MCP server, make      │
└─────────────────────────────────┘  └───────────────────────┘  │ plugin, GitHub Action │
                                                                └───────────────────────┘
```

**Data flow:**
1. `init` writes `.demovie/{config.json, brand/, glossary.*, routes.json}`.
2. `capture` writes `.demovie/captures/**`.
3. The agent writes `videos/<slug>/{brief.md, storyboard.md, video.json, composition/}`.
4. The agent iterates with `stills` and `preview`.
5. `qa` must pass.
6. `audio` produces the mix.
7. `render` writes `videos/<slug>/out/*.mp4`.

---

## 5. Repository, stack, packaging

### 5.1 Layout
```
demovie/
├─ packages/
│  ├─ cli/          # published as `demovie` (bin: demovie); bundles the private packages below
│  ├─ core/         # schemas, config, project dir, detection, extractors, changes
│  ├─ capture/      # Playwright: lifecycle, auth, routes, flows, element maps, redaction
│  ├─ runtime/      # browser runtime; published as `@demovie/runtime`
│  ├─ render/       # static server, frame stepping, encoding, stills, preview
│  ├─ qa/           # QA rules engine
│  ├─ audio/        # synth, SFX, TTS providers, captions, mixing
│  ├─ mcp/          # MCP server
│  ├─ skill/        # Agent Skill source: demovie/SKILL.md + references/ + templates/
│  └─ action/       # GitHub Action (composite): action.yml + scripts
├─ plugins/demovie/            # Claude Code plugin (skill + .mcp.json), generated from packages/skill at build
├─ .claude-plugin/marketplace.json
├─ examples/
│  ├─ harborly/                # fixture Next.js 16 SaaS: App Router, auth, seeded demo data (§16.1)
│  ├─ pages-minimal/           # Pages Router detection fixture
│  ├─ static-site/             # generic-mode fixture (plain HTML)
│  └─ compositions/            # reference compositions (one per style preset + bad-* fixtures for QA)
├─ docs/                       # user docs (§19)
├─ scripts/verify.ts           # the single verification entrypoint (§18)
└─ SPEC.md AGENTS.md CLAUDE.md PROGRESS.md DECISIONS.md GOAL.md README.md LICENSE …
```

### 5.2 Stack
| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript 5.x, `strict`, ESM only | |
| Workspace | pnpm workspaces | Node + Playwright is the reference runtime, and `npx` is the main install path |
| Runtime support | Node ≥ 20.19 (22 LTS in CI); also runs via `bunx demovie` | bunx is smoke-tested |
| Bundling | tsdown (or tsup) | single-file CLI bundle, fast startup |
| CLI | `commander` (or `citty`), `@clack/prompts`, `picocolors` | |
| Validation | `zod` v4; JSON Schemas generated from zod | single source of truth |
| Browser | `playwright-core`; Chromium installed on demand (`demovie doctor --fix`) | |
| Animation | `gsap` (free standard license, plugins included), served locally to compositions | |
| Encoding | system `ffmpeg` / `ffprobe`, checked by `doctor` | not bundled (GPL builds) |
| Images | `pngjs` + `pixelmatch` (pure JS) | no native deps |
| Processes | `execa`, `tree-kill`, `get-port` | |
| Watching | `chokidar` | preview hot reload |
| TS in compositions | `esbuild` transform on the fly | |
| MCP | `@modelcontextprotocol/sdk` | |
| Tests | `vitest` | real Chromium for integration |
| Lint/format | Biome | |
| Releases | changesets (prepared, never executed by the builder) | |

### 5.3 Published artifacts
- **`demovie`**: the CLI and all Node functionality (bin `demovie`). Includes runtime assets, the skill, SFX, fallback fonts and JSON Schemas.
- **`@demovie/runtime`**: the browser runtime, for standalone use.
- Everything else is a private workspace package bundled into `demovie`.
- Target unpacked size: under 15 MB, excluding Chromium (downloaded on demand).

### 5.4 Dependency and asset policy
- **Allowed licenses:** MIT, Apache-2.0, BSD-2/3, ISC, 0BSD, MPL-2.0 (unmodified), CC0, and OFL for fonts. `scripts/check-licenses.ts` runs inside `verify`.
- **Forbidden:**
  - GPL, AGPL or LGPL code bundled into the package.
  - Any Remotion package.
  - Any audio not generated by demovie or imported by the user with an explicit license flag.
- **Bundled fallback fonts:** Inter, Geist and Geist Mono (OFL), with their license files included.
- No network calls at render time, no telemetry, and no update-check pings.

---

## 6. The `.demovie/` project directory

```
.demovie/
├─ config.json                  # committed — §6.1
├─ brand/brand.json             # committed — §6.2 (+ logo files, fonts/)
├─ glossary.md, glossary.json   # committed — §6.3 (md is human-editable and authoritative)
├─ routes.json                  # committed — §6.4
├─ flows/*.flow.yaml | *.flow.ts   # committed — §9.7
├─ assets/ + assets.json        # committed — user resources (images, videos, scripts) with descriptions
├─ videos/<slug>/               # committed, except out/, qa.json and audio caches
│  ├─ brief.md  storyboard.md  video.json
│  ├─ composition/ index.html main.js styles.css (+ any files)
│  ├─ audio/ music.wav beats.json voice/*.mp3 voice.json mix.wav provenance.json
│  ├─ qa.json                   # gitignored
│  └─ out/                      # gitignored: *.mp4, *.webm, poster-*.png, preview.gif, captions.vtt/.srt, share.md
├─ captures/                    # gitignored by default (may contain data) — §6.5
├─ .env                         # gitignored: credentials, API keys
├─ .auth/                       # gitignored: Playwright storage state
├─ .cache/                      # gitignored: frames, voice cache, app.log, pids
└─ .gitignore                   # generated by init
```

`init` MUST NOT modify files outside `.demovie/`, with these exceptions:
- Project-level skill folders (`.claude/skills/demovie`, `.agents/skills/demovie`).
- Project MCP config for the selected agents (e.g. `.cursor/mcp.json`), merged rather than overwritten.
- With explicit confirmation only: a `demo:seed` package script or `.github/workflows/demovie.yml` (via `ci init`).

User-level or global config is never modified. Print instructions instead.

### 6.1 `config.json`
```jsonc
{
  "$schema": "./node_modules/demovie/schema/config.schema.json", // unpkg URL fallback when not installed locally
  "version": 1,
  "project": {
    "name": "Harborly",
    "framework": "nextjs",                     // "nextjs" | "generic"
    "root": ".",
    "nextjs": { "version": "16.0.3", "router": "app", "appDir": "src/app", "pagesDir": null }
  },
  "app": {
    "url": "http://localhost:3000",
    "start": { "command": "pnpm dev", "cwd": ".", "env": { "DEMO_MODE": "1" }, "readyPath": "/", "timeoutMs": 120000 },
    "reuseRunning": true,
    "headers": {}                              // e.g. { "x-vercel-protection-bypass": "$env:VERCEL_AUTOMATION_BYPASS_SECRET" }
  },
  "demo": {
    "seed": "pnpm demo:seed",                  // optional; runs before start/capture
    "now": "2026-09-15T10:30:00.000Z",         // frozen page clock for captures
    "timezone": "UTC", "locale": "en-US",
    "colorScheme": "light",                    // "light" | "dark" | "both"
    "hide": [".cookie-banner", "#intercom-container"],
    "blockRequests": ["*google-analytics.com*", "*googletagmanager.com*", "*posthog.com*", "*segment.io*", "*hotjar.com*"],
    "mask": { "patterns": ["email", "phone", "secret"], "selectors": [], "allow": ["*@harborly.demo"] }
  },
  "auth": {
    "strategy": "form",                        // "none" | "form" | "storageState" | "script"
    "loginPath": "/login",
    "usernameEnv": "DEMOVIE_USER", "passwordEnv": "DEMOVIE_PASSWORD",
    "successPath": "/app",
    "script": null                             // ".demovie/auth.ts" when strategy = "script"
  },
  "capture": {
    "viewports": {
      "desktop": { "width": 1440, "height": 900, "deviceScaleFactor": 2 },
      "mobile":  { "width": 390,  "height": 844, "deviceScaleFactor": 3, "isMobile": true }
    },
    "defaultViewports": ["desktop"],
    "routes": { "include": ["**"], "exclude": ["/api/**"], "params": { "/app/projects/[id]": ["prj_launch"] } },
    "fullPage": ["/", "/pricing"],
    "waitFor": { "/app": "main" },
    "concurrency": 3
  },
  "video": { "fps": 30, "formats": ["16:9", "9:16"], "style": "clean" },
  "audio": {
    "music": { "provider": "synth" },          // "synth" | "elevenlabs" | "file" | "none"
    "voice": { "provider": "none", "voiceId": null, "model": null }  // "none" | "elevenlabs" | "openai"
  },
  "agents": ["claude", "codex", "cursor"]
}
```
- Any string value of the form `"$env:NAME"` resolves from the process env or `.demovie/.env`.
- Secrets MUST only appear in config as env references.

### 6.2 `brand/brand.json`
```jsonc
{
  "name": "Harborly",
  "tagline": "Plan, ship and measure every launch.",
  "url": "https://harborly.example",
  "colors": {
    "light": { "background": "#ffffff", "foreground": "#0b1220", "primary": "#2563eb", "primaryForeground": "#ffffff",
               "secondary": "#…", "accent": "#…", "muted": "#…", "mutedForeground": "#…", "border": "#…", "ring": "#…",
               "chart": ["#…", "#…"] },
    "dark": { /* same keys */ }
  },
  "fonts": {
    "heading": { "family": "Geist", "weights": [500, 600, 700], "files": ["brand/fonts/geist-latin-600.woff2"] },
    "body":    { "family": "Geist", "weights": [400, 500], "files": ["…"] },
    "mono":    { "family": "Geist Mono", "weights": [400], "files": ["…"] }
  },
  "radius": { "sm": "6px", "md": "8px", "lg": "12px" },
  "shadows": ["0 1px 2px rgb(0 0 0 / 0.06)"],
  "logo": { "mark": "brand/logo-mark.svg", "wordmark": "brand/logo.svg", "onDark": null },
  "og": { "image": "brand/og.png", "title": "…", "description": "…" },
  "provenance": { "colors.light.primary": "css-var --primary @ src/app/globals.css:12 (runtime-confirmed)" }
}
```
- All colors are normalized to sRGB hex. The original value (oklch, hsl, …) is kept in `provenance`.
- Missing values are `null`, with a warning.

### 6.3 Glossary
`glossary.md` is human-editable and authoritative. `glossary.json` is derived from it:
```jsonc
{
  "productName": "Harborly",
  "tagline": "…",
  "features": [{ "term": "Projects board", "source": "nav + h1 on /app/projects" }],
  "uiLabels": ["New project", "Launch checklist", "Velocity"],   // exact casing
  "entities": ["Acme Rockets", "Northwind", "Q3 Launch"],         // from demo data only
  "people": ["Maya Chen", "Leo Park"],                             // from demo data only
  "ctaUrl": "harborly.example",
  "avoid": ["tasks"]                                               // words the product does NOT use (user-maintained)
}
```
- `demovie glossary sync` regenerates the json from the md.
- `capture` appends newly seen UI labels to a "Discovered" section of the md, never overwriting user edits.

### 6.4 `routes.json`
```jsonc
{
  "generatedAt": "2026-…",
  "routes": [
    { "path": "/app/projects/[id]", "file": "src/app/app/projects/[id]/page.tsx", "dynamic": true,
      "params": ["prj_launch"], "protected": true, "source": "fs", "title": "Project" },
    { "path": "/pricing", "file": "src/app/(marketing)/pricing/page.tsx", "protected": false, "source": "fs" },
    { "path": "/changelog", "file": null, "protected": false, "source": "crawl" }
  ]
}
```

### 6.5 Captures
```
captures/
├─ index.json                                # all states: id, capturedAt, gitSha, source hashes, config hash
├─ routes/<route-slug>@<viewport>[.dark]/    # e.g. routes/app-projects@desktop
│  ├─ screen.png       # viewport screenshot at deviceScaleFactor
│  ├─ full.png         # optional full-page screenshot
│  ├─ elements.json    # element map (§9.6)
│  └─ meta.json        # url, title, viewport, dpr, colorScheme, capturedAt, gitSha, redactions, warnings
└─ flows/<flow-name>@<viewport>/
   ├─ flow.json        # steps: action, target element id + bbox at action time, typed values, timings
   └─ <step-name>/ screen.png elements.json meta.json
```
The capture id is the path relative to `captures/`, e.g. `routes/app-projects@desktop` or `flows/create-project@desktop/created`.

### 6.6 Video folder files
- **`brief.md`**
  - Frontmatter: `type, duration, formats, style, audience, goal, message, cta, voice, music, references[], resources[], about`.
  - Body: context, at most 3 key points, and "what's new" for changelogs.
- **`storyboard.md`**
  - Frontmatter: `bpm`.
  - Then a table with columns `# | start | dur | kind | visual | on-screen text | VO line | captures / element ids | transition | notes`.
  - `kind` is one of `product|title|text|logo|other`.
- **`video.json`**:
```jsonc
{
  "slug": "launch", "title": "Harborly — Projects board", "type": "launch",
  "fps": 30, "duration": 34.0, "formats": ["16:9", "9:16"], "style": "clean", "poster": 12.5,
  "status": "storyboard",                      // brief | storyboard | styleframes | animating | qa-pass | rendered
  "audio": {
    "music": { "src": "audio/music.wav", "gain": -14, "beats": "audio/beats.json" },
    "voice": { "manifest": "audio/voice.json" },
    "sfx": [{ "name": "whoosh-short", "at": 4.0, "gain": -10 }],
    "loudness": { "targetLufs": -16, "truePeak": -1.5 }
  },
  "captions": { "enabled": true, "burnIn": ["9:16"] },
  "captures": ["routes/app-projects@desktop", "flows/create-project@desktop/created"],
  "qa": { "ignore": [] }                       // rule ids the user explicitly waives
}
```

---

## 7. CLI reference

**Global flags:**
- `--cwd <dir>`
- `--json`: machine output only on stdout; logs go to stderr.
- `--verbose`
- `--yes` / `-y`: accept defaults, never prompt.
- `--no-color`

**Exit codes:**
- `0`: success.
- `1`: operation failed, or QA found errors.
- `2`: usage or config error.
- `3`: missing prerequisite (ffmpeg, Chromium, Node version).
- `4`: app unreachable or auth failed.

**Errors** always print what failed, why, and a `fix:` line with the exact command or edit that fixes it. In `--json` mode the output is `{ "ok": false, "error": { "code", "message", "fix" } }`.

| Command | Purpose |
|---|---|
| `demovie` | Alias of `status`, plus a "next step" hint |
| `demovie init [--url <url>] [--framework nextjs\|generic] [--app <path>] [--agents claude,codex,cursor] [--yes]` | Detect, extract and set up (§8). Seed any new `glossary.md` from `--about` or the README |
| `demovie doctor [--fix]` | Check Node, ffmpeg (+libx264), ffprobe, Chromium, config validity, app reachability, auth and git. `--fix` installs Chromium via Playwright and creates missing folders |
| `demovie status` | Project state: config, app, auth, capture freshness, videos and their status, next step |
| `demovie up` / `demovie down` | Start the app in demo mode (seed → start → wait until ready) / stop what `up` started |
| `demovie auth test` · `demovie auth record` | Verify login works · open a headed browser, let the user log in manually (OAuth, magic link, 2FA), save the storage state |
| `demovie extract [brand\|glossary\|routes\|all]` | Re-run the extractors (static, plus runtime when the app is reachable) |
| `demovie glossary sync` | Regenerate `glossary.json` from `glossary.md` |
| `demovie capture [--route <glob>…] [--flow <name>…] [--viewport <name>…] [--dark] [--full-page] [--changed [--since <ref>]]` | Capture states (§9) |
| `demovie flow new <name>` · `demovie flow run <name>` | Scaffold a flow file · run a single flow |
| `demovie changes [--since <ref>]` | Summarize changes and affected routes (§15.1) |
| `demovie add <files…> [--describe "<text>"] [--licensed]` | Import resources into `.demovie/assets`. Videos are transcoded to VP9 WebM, because Chromium lacks H.264; audio requires `--licensed` |
| `demovie new <slug> --type <t> [--duration s] [--format f,…] [--style s] [--about "…"]` | Scaffold a video folder from a type preset and style template |
| `demovie preview <slug> [--port 4400]` | Preview player (§11.7) |
| `demovie stills <slug> (--at t,… \| --every <sec>) [--format f] [--sheet] [--scale n]` | Still frames and a contact sheet (§11.6) |
| `demovie qa <slug> [--format f\|all] [--strict]` | Run QA (§12) |
| `demovie audio music <slug> [--bpm n] [--mood m] [--provider synth\|elevenlabs] [--seed s]` | Music plus `beats.json` |
| `demovie audio sfx [--list]` | List bundled SFX |
| `demovie audio voice <slug> [--provider elevenlabs\|openai] [--voice id] [--yes]` | Synthesize VO lines from the storyboard. Prints a cost estimate first |
| `demovie audio mix <slug>` | Mix music + VO + SFX and normalize loudness into `mix.wav` |
| `demovie render <slug> [--format f\|all] [--quality draft\|final] [--scale n] [--fps n] [--gif] [--webm] [--workers n]` | Render outputs (§11) |
| `demovie make [--agent claude\|codex\|cursor\|custom] [--agent-cmd "<tpl>"] [--model m] [--type t] [--duration s] [--format …] [--about "…"] [--resources …] [--voice] [--review\|--no-review] [--dry-run] [--yes]` | Launch the user's agent with the skill (§14.4) |
| `demovie mcp` | Start the MCP server on stdio (§14.3) |
| `demovie skill install [--agent …] [--global]` | Install or update the Agent Skill. Project-level by default; `--global` only on explicit request |
| `demovie ci init [--provider github]` | Write `.github/workflows/demovie.yml` (asks for confirmation) |

---

## 8. Detection and extraction (`init`, `extract`)

### 8.1 Framework detection
- **Next.js** when `next` is a dependency of the package at cwd.
  - In monorepos (pnpm/npm/yarn/bun workspaces, Turborepo), find the Next apps under the workspace globs and prompt, or use `--app <path>`.
  - **App Router** if `app/` or `src/app/` contains `page.*` or `layout.*`. **Pages Router** if `pages/` or `src/pages/` exists. An app can have both.
  - Read `next.config.*` **statically** (AST or regex, never execute it) for `basePath`, `i18n` and `output`.
- **Package manager** from the lockfile: `pnpm-lock.yaml`, `bun.lock`/`bun.lockb`, `yarn.lock`, `package-lock.json`.
- **Start command:** prefer `scripts.dev`. Port from `-p`/`--port` in the script, or `PORT`, default 3000. Offer a `build && start` mode (recommended for CI, since it has no dev overlays).
- **Generic mode:** when `--url` is given or no framework is detected. Routes come from crawling; brand and glossary come from runtime extraction only.

### 8.2 Route discovery
- **App Router:** every `page.{tsx,ts,jsx,js,mdx}` becomes a path.
  - Strip route groups `(x)`.
  - Skip private `_folders`.
  - Treat parallel `@slots` as separate routes.
  - Skip intercepting routes `(.)`/`(..)`.
  - Mark dynamic `[x]`, catch-all `[...x]` and optional `[[...x]]` segments.
  - Skip `api/` and `route.ts` handlers.
- **Pages Router:** files under `pages/`, except `_app`, `_document`, `_error` and `api/**`.
- **Dynamic params:**
  1. From `config.capture.routes.params`.
  2. Otherwise from crawling links while logged in (first match per pattern).
  3. Otherwise flagged `needsParams`.
- **Protection hints:** parse the `matcher` in `proxy.ts` or `middleware.ts` (Next 16 renamed middleware to proxy; support both), and folder names (`(auth)`, `app`, `dashboard`). Confirm at capture time: a redirect to login means the route is protected.
- **Crawl** (always in generic mode; a supplement in Next.js mode):
  - BFS from `/` and from the post-login landing page, same-origin only.
  - Up to 50 pages and depth 3 (configurable).
  - Skip asset and file links.
  - **Never** visit logout links (`/log-?out|sign-?out/i`) or destructive-looking links (`delete|remove|destroy|cancel`).
- Write `routes.json` (§6.4), taking titles from `<title>` or `h1` once captured.

### 8.3 Brand extraction
**Static (from source):**
- CSS variables in the global CSS files imported by the root layout: `:root`, `.dark`, Tailwind v4 `@theme`, and shadcn tokens (`--background`, `--primary`, …, including `oklch()`/`hsl()` values). Normalize to hex.
- Tailwind v3 `tailwind.config.*`: read `theme(.extend).colors/fontFamily/borderRadius` statically from the object-literal AST. Never execute the config.
- `components.json` (shadcn): base color and CSS path.
- Fonts: `next/font/google` and `next/font/local` usage in layouts (family, weights, local file paths), and `@font-face` rules.
- Logos: `app/icon.*`, `app/apple-icon.*`, `public/**/{logo,brand,mark,wordmark}*.{svg,png}` and the favicon. Prefer SVG.
- Metadata: literal fields of `export const metadata` in the root layout (title, description, openGraph images).

**Runtime (when the app is reachable; confirms or fills in the static values):**
- Computed styles:
  - body background/foreground;
  - `h1`–`h3` font family and weights;
  - the primary button (the largest-area filled button in main or nav): background, foreground, radius, shadow;
  - link color, border color and card shadow.
- `document.fonts` loaded faces. Download the font files served **by the app itself** (same-origin only) into `brand/fonts/`.
- The header/nav logo: inline SVG `outerHTML` or the `<img>` source, saved into `brand/`.

Record provenance for every token. On conflict, runtime wins for colors actually rendered, and static wins for token names.

### 8.4 Glossary extraction
Sources:
- `package.json`
- the root layout's `metadata`
- README and docs headings
- captured UI text (nav, `h1`–`h3`, buttons, tabs)
- demo seed data seen in captures

Rules:
- Keep exact casing and dedupe.
- Drop generic words ("Home", "Back", "OK").
- Cap `uiLabels` at 200.
- `people` and `entities` come only from demo-mode captures or seed files.

---

## 9. Demo mode, authentication, capture

### 9.1 App lifecycle
1. If `app.url` answers `readyPath` with 2xx/3xx and `reuseRunning` is true, use the running app.
2. Otherwise run `demo.seed` (if set), then `app.start.command` with `app.start.env` merged into the environment.
3. Stream logs to `.demovie/.cache/app.log` and poll until ready or timeout. On timeout, print the last 40 log lines plus fix hints.

- `up` leaves the app running and records its PID. `down` kills the process tree. When `capture` started the app itself, it stops it afterwards.
- If `app.url` is not localhost, `127.0.0.1`, `*.localhost`, `*.test` or a known preview domain, warn and require `--yes`. This avoids creating data in production.

### 9.2 Demo data
- demovie never writes data into the user's app itself. The user's seed command is the source of demo data.
- The skill (§14.1) MAY help the user write a seed script: fictional, plausible, consistent with the glossary, and with no real people or companies unless the user provides them.
- `demo.now` freezes `Date` in the page (Playwright `page.clock.setFixedTime`) so relative dates and charts stay stable. Timers keep running.

### 9.3 Auth strategies
- **`none`.**
- **`form`:**
  1. Open `loginPath`.
  2. Detect the email/username and password inputs by type, autocomplete and label; fill them from env.
  3. Submit with Enter or the primary submit button.
  4. Wait for `successPath`, or for the URL to leave the login page.
  5. Save the storage state to `.demovie/.auth/state.json`. Reuse it until it fails, then log in again.
- **`storageState`:** `auth record` opens a headed browser at `loginPath`. The user logs in (OAuth, magic link, 2FA). When the browser reaches `successPath`, or the user presses Enter in the terminal, save the state.
- **`script`:** `.demovie/auth.ts` default-exports `async ({ page, baseURL, env }) => void`. It is transpiled with esbuild.
- `auth test` prints success, the landing URL and cookie **names** (never values).

### 9.4 Browser setup for capture
Launch Chromium with these context options:
- `colorScheme`, `locale`, `timezoneId`
- `deviceScaleFactor` per viewport
- `reducedMotion: "reduce"`
- extra HTTP headers from config
- request blocking per `demo.blockRequests`

Inject CSS that hides the `demo.hide` selectors, the Next.js dev indicators (`nextjs-portal`) and scrollbars. Hide the caret.

### 9.5 Capture procedure (per state)
1. Navigate. On an unexpected redirect to login, re-authenticate once. If it still redirects, fail with a fix hint.
2. Wait for all of:
   - `load`
   - network idle (500 ms quiet, cap 10 s)
   - `document.fonts.ready`
   - the route's `waitFor` selector
   - images decoded
   - layout stability: two rAF-separated snapshots of the main content's bounding boxes are equal (cap 3 s).
3. Apply redaction (§9.8).
4. Screenshot with `animations: "disabled"` and `caret: "hide"` → `screen.png`. When full-page is requested, also write `full.png` (max 10,000 px tall).
5. Build the element map (§9.6) → `elements.json`; write `meta.json`.

Concurrency comes from `capture.concurrency`. Writes are atomic: write to a temp dir, then rename.

### 9.6 Element map
Collected in the page. Include:
- **Interactive elements:** `a`, `button`, `input`, `select`, `textarea`, `[role=button|link|tab|menuitem|checkbox|switch|option]`, `[contenteditable]`, `[tabindex>=0]`.
- **Structure:** headings; landmarks (`nav`, `main`, `aside`, `header`, `footer`, `dialog`).
- **Content:** images and SVGs with alt or aria-label; the first 50 table/grid rows.
- **Explicitly tagged:** anything with `data-testid` or `data-demovie`.

```jsonc
{ "id": "button:new-project", "role": "button", "name": "New project", "tag": "button",
  "text": "New project", "testId": "new-project", "selector": "[data-testid=\"new-project\"]",
  "bbox": { "x": 1204, "y": 88, "width": 132, "height": 36 },     // CSS px from the screenshot's top-left
  "visible": true, "interactive": true, "inViewport": true,
  "style": { "fontFamily": "Geist", "fontSize": 14, "fontWeight": 500, "color": "#ffffff", "background": "#2563eb", "radius": 8 } }
```
- **IDs:** `dm:<value>` for `data-demovie`; otherwise `<role>:<slug(accessible name)>`. Duplicates become `…#2`, `…#3` in document order.
- IDs MUST stay stable across re-captures of an unchanged page. This is tested.

### 9.7 Flows
Written as YAML (`*.flow.yaml`) or TypeScript (`*.flow.ts`).
```yaml
name: create-project
start: /app/projects
viewport: desktop              # optional; default = first of config.capture.defaultViewports
steps:
  - capture: board
  - click: { role: button, name: New project }
  - capture: dialog
  - fill: { label: Project name, value: Q3 Launch }
  - click: { role: button, name: Create }
  - waitFor: { text: Q3 Launch }
  - capture: created
  - hover: { testId: velocity-chart }
  - capture: chart-hover
```
- **Targets** resolve through Playwright's `getByRole`, `getByLabel`, `getByText`, `getByTestId`, or `locator(css)`. An `element: <element id>` form is also accepted.
- **Steps:** `goto, click, dblclick, fill, press, hover, select, check, uncheck, scroll, wait, waitFor, capture`.
- **Action targets in `flow.json`:** for every action, record the target's element id and bbox **in the coordinate space of the most recent captured state**. A composition can then move the cursor there before swapping to the next state. Also record typed values.
- **TS flows:** `export default defineFlow({ name, start, run: async ({ page, capture, step }) => { … } })`.
- **Guardrail:** refuse steps whose target looks destructive (delete, remove, logout, billing, cancel) unless the flow sets `allowDestructive: true`.

### 9.8 Redaction
- Before each screenshot, replace matches in DOM text nodes and input values:
  - `email`: except the `mask.allow` globs.
  - `phone`.
  - `secret`: e.g. `sk_live_…`, `ghp_…`, `AKIA…`, JWT-like strings.
- Replacements are fictional values of similar length, or `•••` (configurable).
- Elements matching `mask.selectors` are blurred with a CSS filter.
- Record counts per pattern in `meta.redactions`. Redaction is on by default.

### 9.9 Freshness
- `captures/index.json` stores:
  - the git HEAD;
  - a hash of each route's source file plus its layout chain;
  - the config hash.
- `status` marks captures stale when any of these change.
- `capture --changed` re-captures only stale or affected states.

---

## 10. Composition runtime (`@demovie/runtime`)

Compositions are plain web pages. `composition/index.html` loads the runtime and the author's module.
- **Size:** under 60 KB min+gz, excluding GSAP.
- **Dependencies:** none apart from GSAP.
- **Framework:** agnostic.
- **Optional helpers:** the agent may write any DOM, SVG or canvas code as long as it follows §10.1.

### 10.1 Renderer contract
```html
<!doctype html><html><head>
  <meta charset="utf-8">
  <script src="/__demovie/clock.js"></script>          <!-- MUST be the first script: installs virtual time -->
  <link rel="stylesheet" href="/__demovie/runtime.css">
  <link rel="stylesheet" href="./styles.css">
</head><body>
  <div id="stage"></div>
  <script type="module" src="./main.js"></script>
</body></html>
```
```ts
// exposed on window.__DEMOVIE__
interface DemovieHandle {
  version: string;
  ready: boolean;                  // true after v.ready() AND fonts/images loaded
  error?: string;                  // fatal setup error, surfaced by the renderer
  meta: { fps: number; duration: number; width: number; height: number; format: FormatId; scale: number };
  seek(t: number): Promise<void>;  // render the state at time t (seconds); must be order-independent
  inspect(): InspectResult;        // registries + visible text/layout at the current t (used by QA)
}
```
The renderer picks the format through the URL query `?format=9:16&scale=1`. The default comes from `video.json`.

**Determinism rules** (MUST; QA enforces them where possible):
- **Timeline.** All GSAP tweens live in `v.timeline`, the paused master timeline. The runtime detaches GSAP's ticker and disables lag smoothing. Stray tweens on `gsap.globalTimeline` are an error (`DM-R03`).
- **`seek(t)` order:**
  1. set the virtual clock;
  2. `v.timeline.seek(t, false)`;
  3. set `currentTime` on registered WAAPI animations;
  4. call the `onSeek` callbacks;
  5. seek registered `<video>` elements and await `seeked`;
  6. flush pending rAF callbacks once, with timestamp `t*1000`;
  7. await `document.fonts.ready` and pending image decodes;
  8. resolve after two rAFs.
- **Virtual clock** (`clock.js`) overrides `performance.now`, `Date.now`/`new Date()` and `requestAnimationFrame`/`cancelAnimationFrame`. The epoch is `demo.now`, or 2026-01-01T00:00:00Z. `setTimeout`/`setInterval` work only during setup, before `ready()`. After that they are no-ops, and QA records a warning (`DM-R05`).
- **Randomness.** `Math.random` becomes a seeded PRNG. `v.random(seed)` gives independent streams.
- **CSS.** Transitions are disabled globally (`transition: none !important`). CSS keyframe animations must be registered via `v.css(el, keyframes, { start, duration, easing })`. Unregistered running animations raise `DM-R04`.
- **Network.** Same-origin assets served by the renderer only.
- **Setup** may be async but MUST call `v.ready()` exactly once.

### 10.2 Stage, formats, safe areas
The runtime:
- sizes `#stage` to the format's pixel size;
- sets `data-format="16:9"` on `<html>`, so compositions can adapt layout per format with CSS;
- sets CSS vars:
  - layout: `--dm-w`, `--dm-h`, `--dm-safe-top/right/bottom/left`, `--dm-unit` (1% of the short side);
  - brand: `--dm-bg`, `--dm-fg`, `--dm-primary`, `--dm-primary-fg`, `--dm-accent`, `--dm-muted`, `--dm-border`, `--dm-font-heading/body/mono`, `--dm-radius`;
- registers brand fonts from `/brand/fonts/*`, with Inter/Geist as fallbacks.

| Format | Size (scale 1) | Safe area T / R / B / L (%) |
|---|---|---|
| 16:9 | 1920×1080 | 5 / 5 / 5 / 5 |
| 9:16 | 1080×1920 | 12 / 6 / 20 / 6 |
| 1:1 | 1080×1080 | 6 / 6 / 6 / 6 |
| 4:5 | 1080×1350 | 6 / 6 / 8 / 6 |

`--scale 2` renders at double resolution (e.g. 4K) with the identical layout.

### 10.3 API (ESM from `/__demovie/runtime.js`)
```ts
export function createVideo(opts?: { stage?: HTMLElement }): Promise<Video>;

interface Video {
  meta: VideoJson; format: FormatId; width: number; height: number; fps: number; duration: number;
  stage: HTMLElement; safe: Insets; unit: number;
  brand: Brand; glossary: Glossary; beats?: Beats;           // beats from audio/beats.json if present
  gsap: typeof import("gsap").gsap; timeline: gsap.core.Timeline;
  shot(id: string, start: number, end: number, o?: { kind?: "product" | "title" | "text" | "logo" | "other"; el?: HTMLElement }): Shot;
  css(el: Element, keyframes: Keyframe[], o: { start: number; duration: number; easing?: string; fill?: FillMode }): void;
  onSeek(fn: (t: number) => void): void;                     // must be a pure function of t (canvas/WebGL)
  random(seed: string | number): () => number;
  beat(n: number): number; bar(n: number): number;           // seconds; requires beats
  ready(): void;
}

// Product UI — the only sanctioned way to show product UI
export function screen(v: Video, o: {
  capture: string;                          // e.g. "routes/app-projects@desktop" | "flows/create-project@desktop/created"
  parent?: HTMLElement;
  device?: "browser" | "laptop" | "phone" | "tablet" | "none"; // CSS-drawn frames; browser bar shows the captured URL path
  width?: number;                           // displayed width in stage px (default: fits the safe area)
  image?: "screen" | "full";               // "full" for scroll shots
  shadow?: boolean; tilt?: { x: number; y: number };           // CSS 3D
}): ScreenHandle;

interface ScreenHandle {
  el: HTMLElement; capture: CaptureState;
  rect(elementId: string): Rect;            // element rect in stage px at the screen's base transform
  focus(target: string | Rect, o: { at: number; duration?: number; scale?: number; padding?: number; ease?: string }): void; // camera zoom/pan
  reset(o: { at: number; duration?: number; ease?: string }): void;
  highlight(elementId: string, o: { at: number; duration?: number; style?: "ring" | "glow" | "dim-others" }): void;
  swap(capture: string, o: { at: number; duration?: number; transition?: "cut" | "crossfade" | "slide-left" | "slide-up" }): void;
  scroll(to: number | string, o: { at: number; duration?: number; ease?: string }): void;   // full-page captures
}

export function cursor(v: Video, o?: { style?: "mac" | "pointer" | "dot"; size?: number }): CursorHandle;
interface CursorHandle {
  moveTo(s: ScreenHandle, elementId: string, o: { at: number; duration?: number; ease?: string; anchor?: "center" | [number, number] }): void; // natural curved path
  click(o: { at: number; ripple?: boolean }): void;
  show(o: { at: number }): void; hide(o: { at: number }): void;
}

export function typeText(s: ScreenHandle, elementId: string, text: string, o: { at: number; cps?: number; caret?: boolean }): void; // overlays text in the input's captured font and box

export const text: {
  reveal(el: HTMLElement, o: { at: number; by?: "char" | "word" | "line"; stagger?: number; duration?: number; ease?: string; from?: "below" | "fade" | "blur" | "mask" }): void;
  counter(el: HTMLElement, o: { at: number; from: number; to: number; duration: number; format?: Intl.NumberFormatOptions }): void; // values must come from brief/seed/captures
};
export function callout(s: ScreenHandle, elementId: string, o: { label: string; at: number; duration: number; side?: "top" | "right" | "bottom" | "left" }): void;
export function captions(v: Video, o?: { style?: "clean" | "bold" | "karaoke"; position?: "bottom" | "top" }): void; // reads the voice manifest
export const transition: {                  // between Shot containers
  crossfade(a: Shot, b: Shot, o: { at: number; duration?: number }): void;
  wipe(a: Shot, b: Shot, o: { at: number; duration?: number; direction?: "left" | "right" | "up" | "down" }): void;
  push(a: Shot, b: Shot, o: { at: number; duration?: number; direction?: "left" | "right" | "up" | "down" }): void;
  zoomThrough(a: Shot, b: Shot, o: { at: number; duration?: number; target?: Rect }): void;
  colorFlash(a: Shot, b: Shot, o: { at: number; duration?: number; color?: string }): void;
};
export function logo(v: Video, o: { at: number; variant?: "mark" | "wordmark"; parent?: HTMLElement }): HTMLElement;
```
- Cursor, focus, highlight and callout coordinates come from element maps. Never hard-code pixels over product UI.
- `rect()` throws a descriptive error for an unknown element id, listing the nearest valid ids.

### 10.4 Assets served to compositions
- `/__demovie/*`: runtime, clock, CSS, GSAP (+ plugins), fallback fonts, SFX.
- `/brand/*`, `/captures/*`, `/assets/*`.
- `/audio/*`: the video's audio folder.
- `/video.json`, `/glossary.json`.

Composition-relative files resolve normally. `.ts` files are transpiled on the fly.

### 10.5 Style presets
Each preset consists of:
- `runtime/styles/<name>.css` (tokens);
- `skill/references/styles/<name>.md` (motion tokens, type scale, do and don't);
- `examples/compositions/<name>-launch/`, a reference composition using Harborly captures that passes QA.

The presets:
- **`clean`:** neutral brand background, one accent, expo/quart-out easing over 0.5–0.9 s, subtle depth. Restrained, in the manner of Linear or Vercel.
- **`bold`:** kinetic type at 10–16% of frame height, brand-primary backgrounds, hard cuts on the beat.
- **`soft`:** rounded shapes, gentle springs (`back.out(1.2–1.5)`), soft shadows, light tints.
- **`editorial`:** large display or serif type if the brand has one, slower 1.0–1.4 s moves, generous whitespace.
- **`terminal`:** a dev-tool feel, with mono type, code/CLI reveals and grid backgrounds.

---

## 11. Rendering

### 11.1 Server and sandbox
- Each render starts a local static server on an ephemeral port serving the §10.4 paths, bound to 127.0.0.1.
- Launch Chromium headless with flags that stabilize output (sRGB color profile, hidden scrollbars, and deterministic font rendering where the platform supports it). Document the chosen flags in code.
- Request interception allows the server origin only. Every other request is aborted and recorded for QA (`DM-A03`).

### 11.2 Frame stepping
- **Workers.** Open N pages (default `min(4, max(1, floor(cpus/2)))`), each with the format viewport and `deviceScaleFactor = scale`.
- **Readiness.** Wait for `__DEMOVIE__.ready`. After 60 s, fail and include the composition's console errors.
- **Frames.**
  - Split the frames into contiguous ranges per worker.
  - For frame `i`: `await seek(i / fps)`, then capture with CDP `Page.captureScreenshot`.
  - Format: PNG for `final`, JPEG q≈92 for `draft`. Benchmark this and record the result in DECISIONS.md.
  - Write to `.demovie/.cache/frames/<renderId>/<format>/%06d.png|jpg`.
- **Resume.** `renderId` is a hash of the composition dir, the captures used, `video.json`, format and scale. Re-running skips existing frames.
- **Draft quality** means scale 0.5 and 15 fps unless overridden.

### 11.3 Encoding and outputs
- **Video:**
  - `libx264`, `yuv420p`, `-profile:v high`, `-movflags +faststart`.
  - `-crf 18 -preset slow` for final; `-crf 28 -preset veryfast` for draft.
  - Explicit RGB→YUV BT.709 conversion, with BT.709 color tags.
  - Fallback encoders when libx264 is missing: `h264_videotoolbox` (macOS), then `libopenh264`.
- **Audio:** `audio/mix.wav` when present, encoded as AAC 192 kbps at 48 kHz. Otherwise a silent AAC track, for platform compatibility.
- **Outputs** in `videos/<slug>/out/`:
  - `<slug>-16x9.mp4` (one file per format);
  - `poster-<fmt>.png`, taken at `video.json.poster` or at 40% of the duration;
  - `captions.vtt` and `.srt` when there is voice;
  - optional `preview.gif` (720 px wide, 12 fps, palettegen);
  - optional `.webm` (VP9);
  - for `hero-loop`: a seamless loop.
- **Report.** `render` returns paths, durations, sizes, fps, the encoder used and render time (JSON with `--json`).

**Type presets** (defaults; all overridable):
| Type | Default duration | Allowed range | Default formats | VO | Music |
|---|---|---|---|---|---|
| changelog | 15 s | 10–20 s | 16:9, 1:1 | off | on |
| teaser | 12 s | 8–15 s | 9:16, 1:1 | off | on |
| feature | 25 s | 20–35 s | 16:9, 9:16 | optional | on |
| launch | 35 s | 25–50 s | 16:9, 9:16 | optional | on |
| walkthrough | 75 s | 60–120 s | 16:9 | recommended | low |
| hero-loop | 10 s | 6–15 s | 16:9, 4:5 | off | none (muted) |

### 11.4 Audio mixing
`audio mix` combines:
- music, with its gain and ducking of −8 dB under VO (150 ms attack, 400 ms release);
- VO lines at their `start` times;
- SFX at their cue times.

Then:
- Fade the music out over the last 1.0 s.
- Run two-pass `loudnorm` to the target (default −16 LUFS integrated, −1.5 dBTP).
- Write `audio/mix.wav` (48 kHz stereo).

### 11.5 Captions
- Burned-in captions are drawn by the runtime (`captions()`), so their styling matches the video.
- Sidecar VTT and SRT files are generated from the voice manifest.
- Captions burn in by default for 9:16 whenever VO exists.

### 11.6 Stills and contact sheets
- `stills` renders the requested times per format, at scale 0.5 by default.
- With `--sheet`, it also produces a contact-sheet PNG: a grid with timestamp labels, shot ids and safe-area guides. Build it by screenshotting an HTML grid page, so no image library is needed.
- File paths are returned in `--json` so agents can open the images and look at them.

### 11.7 Preview server
`preview <slug>` serves a player page on 127.0.0.1 with:
- an iframe of the composition;
- play/pause, driven by wall-clock seeks;
- a scrubber with shot markers, plus frame stepping;
- a format switcher;
- toggles for safe-area guides, a grid, and a QA overlay showing the violations at the current time (from the last `qa.json`);
- `mix.wav` playing in sync.

Hot reload uses server-sent events whenever the composition, `video.json` or captures change. The command prints the URL.

### 11.8 Performance budgets (8-core laptop, 1080p30)
| Operation | Budget |
|---|---|
| `stills --every 1` for a 30 s video | < 20 s |
| `render --quality draft`, 30 s | < 60 s |
| `render --quality final`, 30 s, one format | < 4 min |
| `capture` of Harborly (all routes + one flow, desktop) | < 60 s |

Measure these in tests and record the actual numbers in PROGRESS.md.

---

## 12. QA engine

`qa` loads the composition exactly as the renderer does.
- It samples at 10 fps (configurable), calling `seek`, then `inspect()`, and taking screenshots where a rule needs pixels.
- It runs all rules, writes `qa.json`, prints a summary, and exits 1 on any error.
- Rules listed in `video.json.qa.ignore` are reported as "waived".
- `--strict` turns warnings into errors.

`inspect()` returns, at the current t:
- visible text boxes: text, bbox, font size/family/weight, color, opacity, and whether it is clipped or overflowing;
- active shots;
- screens, with their transforms and effective pixel density;
- cursor state and click targets;
- registered animations;
- captured console warnings;
- font load status.

| ID | Severity | Rule | Measurement / threshold |
|---|---|---|---|
| DM-T01 | error | Text stays on screen long enough to read | Each distinct non-UI text block is continuously visible for ≥ `0.5 + words/3` s and ≥ 1.2 s |
| DM-T02 | error | Minimum text size | Font size ≥ 3.0% of the frame's short side (captions ≥ 3.8%), at scale 1 |
| DM-T03 | error | No text overflow or clipping | `scrollWidth > clientWidth`, or the text box extends beyond its container or the stage |
| DM-T04 | warn / error | Contrast | WCAG ratio of text color vs. a sampled background ring: < 4.5 warns, < 3.0 errors |
| DM-T05 | warn | Too much text at once | More than 2 non-UI text blocks, or more than 18 words, visible at once |
| DM-L01 | error | Safe area | Non-UI text, logos and the CTA stay inside the format's safe area |
| DM-L02 | error | Overlaps | Two visible non-UI text boxes intersect by more than 5% of the smaller one, or text covers a highlighted product element |
| DM-L03 | warn | Off-stage leftovers | Visible elements sit fully outside the stage for more than 1 s |
| DM-P01 | warn / error | Shot pacing | Warn when the average shot length is below the type floor (launch 1.8 s, feature 1.8 s, walkthrough 2.5 s, teaser 1.2 s, changelog 1.5 s). Error when more than 4 consecutive shots are under 0.8 s |
| DM-P02 | error | Duration | Within the type's range, and equal to `video.json.duration` ± 1 frame |
| DM-P03 | warn | End hold | The final logo/CTA shot is visible for ≥ 1.5 s |
| DM-P04 | error | Shots declared | At least 1 shot, and the shots cover the full duration with no gap over 0.5 s |
| DM-P05 | error | Seamless loop (`hero-loop` only) | First vs. last frame pixel diff < 2% |
| DM-G01 | error | Truthful cursor | Every cursor `click` lands inside its target element's rect under the current screen transform |
| DM-G02 | warn | Invented vocabulary | Capitalized terms in non-UI text that aren't in the glossary, the brief or captured UI text |
| DM-G03 | error | Product shots use captures | Every `kind: "product"` shot contains at least one `screen()` |
| DM-G04 | warn | Invented numbers | Numbers in non-UI text that aren't in the brief, the glossary or captured UI text |
| DM-G05 | warn / error | Upscaled captures | A screen displayed above 1.0× its native pixel density warns; above 1.5× errors (blurry) |
| DM-A01 | error | Fonts | Declared brand and fallback fonts are loaded; no silent fallback to system fonts |
| DM-A02 | error | Assets | Any 4xx/5xx response, or a broken image or video |
| DM-A03 | error | Network | Any blocked external request |
| DM-A04 | error | Audio provenance | An audio file that has no `provenance.json` entry from a demovie generator, a configured provider, or `add --licensed` |
| DM-R01 | error | Determinism | 5 sampled frames rendered twice, in different seek orders, are pixel-identical |
| DM-R02 | warn | Blank frames | Frames that are over 98% one color for more than 0.3 s, outside declared transitions |
| DM-R03 | error | Stray GSAP tweens | Tweens outside `v.timeline` |
| DM-R04 | warn | Unregistered CSS animations | Running CSS animations not registered via `v.css` |
| DM-R05 | error | Timers after ready | `setTimeout`/`setInterval` called after `ready()` |
| DM-S01 | warn / error | Loudness | Integrated loudness outside target ± 2 LU warns; true peak above −1.0 dBTP errors |
| DM-S02 | warn | VO overlap | Voice lines overlap each other or run past the end of the video |
| DM-V01 | warn | "AI look" clichés | Non-UI text that matches HUD, timecode, BPM or "frame N" patterns; generic status chips ("Done", "Saved", "Success") not in the glossary; more than 2 typefaces |

`qa.json` structure:
```jsonc
{
  "slug": "…", "format": "16:9", "sampledFps": 10,
  "rules": [{ "id": "DM-T01", "severity": "error", "status": "fail", "message": "…",
              "occurrences": [{ "t": 3.2, "bbox": {…}, "detail": "…" }], "fix": "…" }],
  "summary": { "errors": 0, "warnings": 1, "waived": 0 }
}
```
Every failure includes a concrete `fix` hint.

---

## 13. Audio

### 13.1 Music synth (the default, license-clean)
- **Input:** `{ bpm (80–140), key, mood: uplifting | tech | calm | energetic | minimal, duration, sections?, seed }`.
- **Output:** 48 kHz stereo WAV, generated with pure TypeScript DSP.
- **Instruments:** kick (sine sweep), snare/clap (filtered noise), hats, bass (saw/sine through a filter), pad (detuned saws, low-pass, slow attack), and pluck/arp. Simple mixing and a limiter.
- **Structure:** follows the storyboard sections (intro, build, main, outro), with an ending hit on the final shot.
- **Determinism:** the same seed gives the same output.
- **Beat grid:** also writes `beats.json` as `{ bpm, offset, beats: number[], bars: number[], sections: [{ name, start, end }] }`.
- **Quality bar:** a pleasant, non-fatiguing background bed.

Other providers:
- **`elevenlabs`** (user's key): generates from a prompt derived from mood and duration. The beat grid comes from the requested BPM or simple onset detection.
- **`file`:** a user track imported with `add --licensed`.

### 13.2 SFX
- A bundled, generated set (deterministic DSP, CC0): `whoosh-short, whoosh-long, swipe, click, soft-click, pop, tick, type-key, riser-2s, impact, shimmer, notification`.
- `scripts/generate-sfx.ts` regenerates them.

### 13.3 Voiceover (optional; the user's own key)
```ts
interface VoiceProvider {
  id: "elevenlabs" | "openai";
  estimateCost(lines: VoiceLine[], o: VoiceOptions): { characters: number; usd: number | null };
  synthesize(lines: VoiceLine[], o: VoiceOptions): Promise<VoiceResult[]>;  // { lineId, file, duration, words: { text, start, end }[], estimated?: boolean }
}
```
- **Providers:**
  - **ElevenLabs:** text-to-speech with timestamps. Convert the character alignment to word timings.
  - **OpenAI TTS:** returns no alignment, so estimate word timings proportionally and set `estimated: true`.
- **Script source:** lines come from the storyboard's VO column, or from a user-provided script resource. Keep the user's wording exactly.
- **Caching:** cache by hash(provider, model, voice, text) in `.demovie/.cache/voice/`.
- **Cost:** print the estimated cost, then require confirmation or `--yes`.
- **Keys:** `ELEVENLABS_API_KEY` and `OPENAI_API_KEY`, from env or `.demovie/.env`. Never logged.
- **Output:** `audio/voice.json` as `{ provider, voice, lines: [{ id, text, start, duration, file, words[] }] }`. `start` comes from the storyboard; the composition may adjust it.

### 13.4 Rules
- Never download audio from the internet.
- Every generator and importer appends to `audio/provenance.json`.
- QA rule `DM-A04` enforces provenance.

---

## 14. Agent layer

### 14.1 Agent Skill `demovie`
- **Source:** `packages/skill/demovie/`.
- **Build output:** copied to `plugins/demovie/skills/demovie/`, and packaged inside the `demovie` npm package for `skill install`.
```yaml
---
name: demovie
description: Make accurate, on-brand motion-graphics videos of the user's real web app (launch, feature, changelog, teaser, walkthrough, landing-page hero loop) with the demovie CLI. Use when the user asks for a product, launch, demo, promo, explainer or changelog video, motion graphics about their app, or a video per release.
---
```
`SKILL.md` is at most 400 lines; details go in `references/`. Required content:

**Workflow**
0. **Preflight.** Run `npx demovie status --json`.
   - Not initialized → run `npx demovie init` and let the user finish setup.
   - App unreachable → run `npx demovie up`.
1. **Understand.** Read `.demovie/brand/brand.json`, `glossary.md`, `routes.json` and the user's resources. For changelogs, also run `npx demovie changes --since <ref> --json`.
2. **Brief.**
   - Run `npx demovie new <slug> --type … --duration … --format …`.
   - Fill `brief.md`: audience, one message, at most 3 points, a CTA.
   - In interactive sessions, confirm the brief with the user in one short message. Skip this with `--yes` or in CI.
3. **Capture plan.**
   - Pick the routes and flows that prove the message.
   - Write any flows in `.demovie/flows/`, using element ids from existing element maps.
   - Run `npx demovie capture …`.
   - **Open the captured `screen.png` files and look at them before storyboarding. Only what is captured exists.**
4. **Storyboard.**
   - Fill `storyboard.md` with shots, timed on the beat grid when there is music.
   - Every product shot names its capture ids and element ids.
   - VO stays at or below 2.6 words/s, and on-screen text within the reading-time budget.
   - Interactive: show the table for approval.
5. **Style frames.**
   - Build static key poses for 3–5 key shots.
   - Run `npx demovie stills <slug> --at … --sheet` and look at the sheet.
   - Self-critique against the rubric and fix what it finds.
   - Interactive: share the sheet path for approval.
6. **Animate.**
   - Build the full timeline with the runtime helpers.
   - Music: `audio music`. Add SFX cues.
   - VO (`audio voice`) only when a provider is configured **and** the user approved the cost.
7. **QA loop.**
   - Run `npx demovie qa <slug> --format all` until there are 0 errors.
   - Then run `stills --every 1 --sheet`, do a rubric self-review and fix what it finds.
   - At most 3 full loops unless the user asks for more. Report any remaining warnings honestly.
8. **Render.** Run `audio mix`, then `render --quality final --format all`.
9. **Report.**
   - Output paths, duration and formats.
   - What is real (captures used) and what is stylized.
   - The QA summary.
   - `out/share.md`: an X post, a LinkedIn post and a changelog blurb, written in the glossary's vocabulary.

**Hard rules**
- Never draw, re-create or mock product UI. Always use `screen()` with real captures. If a needed state isn't captured, capture it by writing a flow, or ask.
- Never invent product names, features, customers, people, metrics or prices. Use only the glossary, the brief, seed data and captured UI.
- Cursor, zoom, highlight and callout targets come from element maps only.
- QA must pass with 0 errors before the final render.
- Never download audio. Paid API calls only with configured keys and the user's approval.
- Don't edit the user's app code unless asked (for example, to add `data-demovie` ids or a seed script). Propose the change first.

**"AI look" to avoid** (taken from the critiques of the viral Opus clips):
- HUD, timecode or BPM corner labels.
- Generic success chips.
- Emoji rain and confetti.
- Neon glows and purple-blue gradients that aren't in the brand.
- Everything centered on a gradient.
- Constant hard cuts.
- More than 2 typefaces.
- Text on screen for less than its reading time.
- Endings with only a logo and no CTA.
- Invented dashboards.

**Rubric** (score each item 1–5; iterate until every score is ≥ 4):
- **Clarity:** a first-time viewer can say what the product does.
- **Truth.**
- **Pacing and legibility.**
- **Hierarchy:** one focal point per moment.
- **Brand fidelity.**
- **Motion quality:** purposeful easing, no linear moves, no jitter, consistent direction.
- **Polish:** alignment, spacing, crisp captures.
- **Ending:** a clear CTA.

**`references/` files:**
- `runtime-api.md` (generated from the runtime's exported types, with examples)
- `motion-principles.md`, `pacing-and-formats.md`
- `brief-template.md`, `storyboard-template.md`
- `flows.md`, `audio.md`
- `styles/{clean,bold,soft,editorial,terminal}.md`
- `examples/` (annotated excerpts of the reference compositions)
- `troubleshooting.md`

### 14.2 Skill distribution
- **`demovie skill install`** writes project-level skill folders for the selected agents. Defaults: `.claude/skills/demovie/` (Claude Code) and `.agents/skills/demovie/` (the Agent Skills convention used by other agents). **Verify the current per-agent skill locations in official docs at build time** and record them in DECISIONS.md.
- **`npx skills add <owner>/demovie`:** the repo is installable this way (skills.sh convention).
- **Claude Code plugin marketplace:**
  - `.claude-plugin/marketplace.json` points to `plugins/demovie/`.
  - That folder contains `plugin.json`, `skills/demovie/`, and `.mcp.json` registering `npx -y demovie mcp`.
  - Verify the manifest formats against the current Claude Code plugin docs at build time.
- **Versioning:** the skill carries a version stamp. `status` warns when the installed skill is older than the CLI.

### 14.3 MCP server (`demovie mcp`, stdio)
Tools (all return JSON; `stills` also returns images as MCP image content):
- `status`
- `init_check` (no prompts; returns what's missing)
- `extract`, `list_routes`, `list_captures`
- `capture` `{routes?, flows?, viewports?, changedSince?}`
- `get_elements` `{captureId, query?}`
- `new_video`
- `stills` `{slug, at | every, format}`
- `qa` `{slug, format}`
- `audio_music`, `audio_voice` (requires `confirm: true`), `audio_mix`
- `render` `{slug, formats, quality}`
- `changes` `{since}`

Long operations send progress notifications.

MCP config per agent:
- **Cursor:** `init` writes project MCP config to `.cursor/mcp.json` (merged) when Cursor is selected.
- **Codex and others:** print the snippet for the user's global config; never edit global config.

### 14.4 `demovie make` (launches the user's own agent)
- **Detection:** find installed agent CLIs on PATH: `claude`, `codex`, and Cursor's CLI (`cursor-agent` or its current name; verify). Show which are available.
- **Prompt:**
  > Use the demovie skill to make a {type} video ({duration}s, {formats}) about: {about}. Resources: {files}. Voiceover: {on|off}. {Review the brief and storyboard with me before animating. | Work autonomously; do not ask questions.}
- **Interactive** (a TTY and `--review`): launch the agent in interactive mode with the prompt as its first message, inheriting stdio.
- **Headless** (`--yes` or CI): use the agent's non-interactive mode (e.g. `claude -p … --output-format stream-json`, `codex exec …`, Cursor's print mode). Stream progress and exit with the agent's exit code. Pass `--model` through when given.
- **Adapters** are data-driven in `adapters/*.ts`: binary, detect, interactive args, headless args, model flag.
  - **Verify each agent's current flags via `--help` at build time** and unit-test the argument construction.
  - `--dry-run` prints the exact command.
  - The `custom` adapter uses `--agent-cmd "mytool run {prompt}"`.

### 14.5 Vendor terms (MUST)
- demovie never:
  - implements AI-vendor login;
  - reads, stores or proxies subscription tokens or cookies;
  - embeds an agent SDK that uses consumer-subscription auth.
- It only launches binaries the user installed and signed into themselves, or passes through API keys the user set in env (CI).
- Names and logos must not contain "Claude", "Codex" or "Cursor". Describing compatibility ("works with Claude Code") is fine.
- `docs/licensing-and-terms.md` explains all of this plainly, including why demovie doesn't use Remotion and how GSAP is licensed.

---

## 15. Changelog mode and GitHub Action

### 15.1 `demovie changes`
- **Input:** `--since <ref>`. Default: the latest tag reachable from HEAD; fallback: the last 20 commits.
- **Output:** `changes.json` plus a readable summary containing:
  - **Commits:** conventional-commit type, scope and subject, plus PR numbers from `(#123)` and merge messages. PR titles and bodies via `gh` only when it is installed and authenticated; never required.
  - **Changed files.**
  - **Affected routes:**
    - Direct: files under app/pages dirs map to routes.
    - Indirect: a reverse import graph from changed modules to pages, resolving tsconfig `paths`, up to depth 6.
  - **Suggestions:**
    - Captures: the affected routes, plus flows that touch them.
    - A story line, e.g. "3 user-visible changes: …", ignoring chores, refactors, tests and docs.

### 15.2 GitHub Action (`packages/action/action.yml`, composite)
- **Inputs:**
  - `agent` (claude | codex; default claude), `agent-version` (pinned)
  - `type` (default changelog), `formats`, `since` (default: the previous tag)
  - `app-url` (e.g. a preview deployment) **or** `start` (a build + start command)
  - `working-directory`
  - `comment` (default true), `upload-release-asset` (default true on release events)
- **Secrets / env:**
  - `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`: API keys, not subscriptions.
  - `DEMOVIE_USER` / `DEMOVIE_PASSWORD`.
  - Optional `VERCEL_AUTOMATION_BYPASS_SECRET`, sent as `x-vercel-protection-bypass` plus `x-vercel-set-bypass-cookie: true`.
  - Optional `ELEVENLABS_API_KEY`.
- **Steps:**
  1. Set up Node and pnpm (with cache), then install dependencies.
  2. Install the agent CLI at the pinned version.
  3. `npx playwright install --with-deps chromium`.
  4. Ensure ffmpeg is installed (`apt-get install -y ffmpeg`).
  5. Run `demovie doctor`.
  6. Run `demovie capture --changed --since …`.
  7. Run `demovie make --agent … --type changelog --yes`.
  8. Upload `out/` as a workflow artifact.
  9. Comment on the PR or release with the poster, links and QA summary.
  10. On `release` events, attach the MP4s to the release (`gh release upload`).
- **Documented triggers:**
  - `release: published`
  - `workflow_dispatch`
  - `deployment_status` for Vercel previews, using `github.event.deployment_status.environment_url`.
- **`demovie ci init`** writes a ready workflow that uses this action, with the placeholder `<owner>/demovie/packages/action@v0` until the repo is published.
- **Testing:**
  - Validate `action.yml` against its schema.
  - Run the action's scripts locally against Harborly with a **mocked agent adapter**. The mock copies a reference composition into place instead of calling an LLM.

---

## 16. Example apps and fixtures

### 16.1 `examples/harborly` (the primary fixture; a fictional product)
"Harborly: plan, ship and measure every launch."
- **Stack:**
  - Next.js 16, App Router in `src/app`, React 19, TypeScript.
  - Tailwind v4, shadcn-style components (vendored, no shadcn CLI at runtime), lucide-react.
  - An MIT-licensed chart library (e.g. Recharts), `next/font` with Geist.
  - No external services.
- **Marketing pages:** `/` (hero, features, fictional customer logos, CTA), `/pricing`, `/changelog`.
- **Auth:**
  - `/login` with email and password.
  - The cookie session is signed with an HMAC via `node:crypto`.
  - `proxy.ts` (or `middleware.ts`, depending on the installed Next version) protects `/app/**`.
- **App pages:**
  - `/app`: KPI cards, velocity chart, activity feed.
  - `/app/projects`: a board with columns.
  - `/app/projects/[id]`: checklist and timeline.
  - `/app/projects/new`: a dialog flow.
  - `/app/team`.
  - `/app/settings`: includes an email and an API-key field, to exercise redaction.
  - A dark-mode toggle.
- **Data:**
  - A JSON file store at `.data/db.json`.
  - `pnpm demo:seed` writes a rich fictional dataset: companies like "Acme Rockets", people like "Maya Chen", and projects like "Q3 Launch".
  - Without the seed, the app shows empty states, which demonstrates why demo mode matters.
  - Seed users: `demo@harborly.demo` / `harborly-demo` (fixture only).
- **Element ids:** some elements carry `data-testid` and a few carry `data-demovie`, to exercise both id paths.
- **Committed `.demovie/`:** from M2 onward it is committed (config, brand, glossary, routes, flows), so tests and docs have a stable reference. Captures are regenerated in tests.

### 16.2 Other fixtures
- **`examples/pages-minimal`:** Pages Router, a Tailwind v3 config and CSS variables. Used for detection and brand tests.
- **`examples/static-site`:** plain HTML/CSS served by a tiny static server. Used for generic-mode tests.
- **`packages/core/test/fixtures/*`:** small file trees for detection edge cases: monorepo, route groups, parallel and intercepting routes, `[[...slug]]`, `basePath`, oklch tokens, local fonts.
- **`examples/compositions/`:**
  - `<style>-launch/`: one per style preset, built on Harborly captures. Each must pass QA with 0 errors.
  - `bad-*`: fixtures that each trigger specific QA rules.

---

## 17. Security and privacy
- **Credentials** live only in `.demovie/.env` or the process env.
- **Generated `.demovie/.gitignore`** covers `.env`, `.auth/`, `.cache/`, `captures/`, `videos/*/out/` and `videos/*/qa.json`.
- **Secret values are never printed.** They are masked in logs and errors; `auth test` prints cookie names only.
- **Redaction** is on by default (§9.8).
- **Capture** blocks analytics and third-party beacons by default, so demovie runs don't pollute the user's analytics.
- **Render sandbox** blocks all external network requests.
- **Local-only servers:** the MCP server uses stdio only; the preview and render servers bind to 127.0.0.1.
- **No telemetry.** `SECURITY.md` explains how to report vulnerabilities.

---

## 18. Testing and verification

**Unit tests** (vitest):
- schemas and config env resolution;
- detection (fixtures), route discovery, the brand and glossary extractors;
- element-id stability, flow parsing, redaction;
- changes and the import graph;
- every QA rule, with one passing and one failing synthetic composition each;
- the runtime (real Chromium where needed);
- audio DSP (duration, sample rate, peak level);
- adapter argument construction.

**Integration tests** (real Chromium + Harborly):
- `init --yes`;
- auth: `form`, `script`, and `storageState` from a saved state;
- capturing routes and a flow;
- element-map stability across two captures;
- freshness and `--changed`;
- render: draft and final, for 2 formats;
- stills and the contact sheet;
- qa;
- audio synth and mix, plus a loudness check via ffmpeg `ebur128`;
- MCP smoke test: an SDK client lists tools and calls `status` and `stills`;
- the preview server serves and hot-reloads.

**Determinism:**
- The same frame rendered twice is identical.
- Out-of-order seeks produce identical frames.

**Golden images:** perceptual diffs (pixelmatch, small tolerance) for the reference compositions on the current platform. Update them with `pnpm test:update-goldens`.

**Package smoke test:**
1. `pnpm pack` the `demovie` package.
2. Install the tarball into a temp dir.
3. Run `npx demovie --version`, `doctor --json`, and `init --yes` against a copy of Harborly.
4. Repeat with `bunx` when bun is installed; skip otherwise.

**`pnpm verify`** (`scripts/verify.ts`) runs the checks below in order. It prints a table and finishes with either `VERIFY OK (<n> checks)` or `VERIFY FAILED (<k> of <n>)`.
1. Biome.
2. Typecheck all packages.
3. Unit tests.
4. Build.
5. License check.
6. Integration tests.
7. QA on the reference compositions: 0 errors.
8. Render smoke test, with ffprobe assertions: codec h264, pix_fmt yuv420p, size, fps, duration ± 1 frame, audio stream present.
9. MCP smoke test.
10. Skill lint: valid frontmatter; referenced files exist; `SKILL.md` ≤ 400 lines; `runtime-api.md` matches the exported symbols.
11. Plugin and marketplace manifests are valid.
12. `action.yml` is valid; dry-run the action scripts.
13. Docs check: internal links resolve, and every CLI command mentioned in the docs exists in `--help`.
14. Package tarball smoke test.

While building, checks for milestones that aren't finished yet report `pending`. At the end, nothing may be `pending`.

**`pnpm verify:dogfood`** checks that the M8 outputs exist, re-runs `demovie qa` on them (0 errors required), and prints ffprobe summaries.

**CI:** `.github/workflows/ci.yml` runs `pnpm verify` on ubuntu-latest and macos-latest with Node 22.

---

## 19. Docs and launch assets
- **`README.md`:**
  - A hero GIF: a side-by-side of Harborly as a "one-prompt" video vs. a "demovie-grounded" one.
  - The one-line pitch.
  - The 3-command quickstart.
  - How it works (diagram), and features.
  - A supported-agents table and an examples gallery.
  - FAQ: "Why not just prompt Opus?", "Why not Remotion?", "Does it use my Claude subscription?", "Where does my data go?"
  - Contributing and license sections.
- **`docs/`:**
  - `getting-started`
  - `concepts`, covering the grounding levels: L0 brand only → L1 public pages → L2 logged-in captures → L3 flows.
  - `config` (generated from the JSON Schema)
  - `capture-and-auth`
  - `demo-data` (how to write a seed script; guidance on fictional data)
  - `compositions` (the runtime API), `styles`
  - `qa-rules` (generated from the rule registry)
  - `audio`
  - `agents` (Claude Code, Codex, Cursor, MCP, `make`)
  - `ci` (GitHub Action, Vercel previews)
  - `licensing-and-terms`, `troubleshooting`, `faq`
- **Community files:**
  - `LICENSE` (MIT) and `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1).
  - `CONTRIBUTING.md`: setup, `verify`, and how to add a QA rule, a style or an agent adapter.
  - `SECURITY.md`.
  - Issue and PR templates, and `CHANGELOG.md` via changesets.
- **README media:** GitHub does not play repository-relative MP4s inline. Use GIF previews with links to the MP4s.

---

## 20. Milestones and acceptance criteria

Work strictly in order. After each milestone:
1. Update PROGRESS.md: tick the boxes, add notes and timings.
2. Run `pnpm verify`. It must pass for everything implemented so far.
3. Commit locally as `feat(mN): <summary>`.

**M0 — Scaffold**
- Run `git init` if the folder isn't a repo yet.
- Monorepo per §5: pnpm, TS strict, Biome, vitest, tsdown.
- CI workflow; LICENSE (MIT), CODE_OF_CONDUCT and SECURITY.
- `scripts/verify.ts` with the full check table; unimplemented checks show as `pending`.
- `examples/harborly` fully working per §16.1: the dev server runs, login works, and the seed works.
- The built bundle runs `demovie --version` and `demovie --help`.

**M1 — Core and init**
- zod schemas for every file in §6, plus the generated JSON Schemas.
- Detection (§8.1), route discovery (§8.2), brand (§8.3), glossary (§8.4), metadata.
- `init` (interactive and `--yes`), `doctor [--fix]`, `status`, `extract`, `glossary sync`.
- **Acceptance:**
  - `demovie init --yes` in Harborly writes a valid config, brand, glossary and routes.
  - It finds the correct primary color, fonts (Geist) and logo.
  - It finds ≥ 10 routes, with correct `protected` flags.
  - The pages-minimal and static-site fixtures are detected correctly.

**M2 — Capture**
- `up`/`down`, seeding, the frozen clock, hide/block, all four auth strategies, `auth test`/`auth record`.
- Route capture, flows (YAML and TS), element maps with stable ids, redaction, freshness, `--changed`.
- **Acceptance:**
  - Capture on Harborly covers all static routes, `[id]` with params, and the `create-project` flow at desktop size, plus mobile for 2 routes.
  - Element ids are stable across two runs.
  - The email and API key on the settings page are redacted.
  - Within budget (§11.8).

**M3 — Runtime, renderer, preview, stills**
- `clock.js` and the runtime API from §10.3 (screen, cursor, typeText, text, callout, captions, transition, logo), plus the style CSS.
- The renderer (§11.1–11.3), stills and contact sheets, and the preview server with hot reload.
- `new` scaffolding with style templates.
- `examples/compositions/clean-launch`.
- **Acceptance:**
  - `clean-launch` renders final MP4s in 16:9 and 9:16.
  - The ffprobe assertions and the determinism tests pass.
  - Budgets from §11.8 are met, or the deviations are recorded with reasons.

**M4 — QA**
- Every rule in §12, each with passing and failing synthetic tests.
- `qa.json` output, fix hints, waivers, `--strict`, and the QA overlay in preview.
- **Acceptance:**
  - `clean-launch` passes with 0 errors.
  - Each `bad-*` fixture triggers its intended rules.

**M5 — Audio**
- Music synth with `beats.json`, and SFX generation.
- Voice providers, tested with mocked HTTP; caching; cost estimates.
- Captions (VTT/SRT and the runtime component); mixing, ducking and loudnorm; provenance and `DM-A04`.
- **Acceptance:**
  - `clean-launch` renders with music and SFX, with measured loudness within target ± 1 LU.
  - Voice tests pass with mocks. Live tests run when keys are present; otherwise they skip with a clear message.

**M6 — Agent layer**
- The skill (§14.1), its references, all 5 style docs, and a reference composition per style. All compositions pass QA.
- `skill install`, the plugin and marketplace manifests, and `npx skills add` compatibility.
- The MCP server with all tools (§14.3).
- `make` with the claude, codex, cursor and custom adapters, interactive and headless, plus `--dry-run`.
- **Acceptance:**
  - The MCP smoke test passes.
  - `make --dry-run` prints the correct command for each adapter. Flags are checked against the installed CLIs' `--help` where available, and the findings recorded in DECISIONS.md.

**M7 — Changelog and CI**
- `changes`, with import-graph route mapping, and `capture --changed`.
- The GitHub Action and `ci init`.
- **Acceptance:**
  - On a Harborly test branch with a commit that changes a shared component, `changes` lists the right affected routes.
  - The action scripts run end-to-end locally with the mocked agent adapter and produce a clip.

**M8 — Dogfood (you are the user's agent)**
Follow `packages/skill/demovie/SKILL.md` literally on Harborly, as a user's agent would:
- **Launch video,** "Harborly — Projects board":
  - 30–40 s, 16:9 and 9:16, style `clean`, synthesized music and SFX.
  - No paid API calls without keys.
  - QA must show 0 errors.
  - Record rubric self-scores (all ≥ 4) and contact-sheet paths in PROGRESS.md.
- **Changelog clip:** 12–18 s, covering the M7 test-branch changes. QA must show 0 errors.
- **Comparison asset:**
  - A "baseline" 30 s video made the way the viral one-prompt clips are: no captures, UI redrawn from imagination.
  - A side-by-side `docs/media/grounded-vs-generic.mp4`, plus a `.gif` of at most 8 MB, for the README.
- **Friction log:** fix every friction point found in the skill or CLI while dogfooding, and log each one in PROGRESS.md.

**M9 — Docs and release readiness**
- Every doc in §19. The README with its GIF. The generated config and QA-rule docs.
- changesets configured; `release.yml` prepared but never run; version 0.1.0.
- The tarball smoke test passes via npx, and via bunx when bun is installed.
- `pnpm verify` and `pnpm verify:dogfood` both pass, PROGRESS.md is complete, and `git status` is clean.

---

## 21. Future (not in v1)
- DOM-snapshot "live layers": crisp vector zoom and in-place text swaps.
- Motion blur via temporal supersampling.
- More frameworks: Vite/React Router, SvelteKit, Nuxt, Astro.
- `flow record`, from Playwright codegen.
- Localized videos.
- Optional hosted render and share links.
- A style/template gallery.
- Storybook component shots.
- App Store preview formats.

## 22. Decisions already made (don't revisit without recording a reason in DECISIONS.md)
- **D1** HTML + GSAP compositions, rendered by our own renderer. No Remotion. No dependency on HyperFrames (competitor-owned, pre-1.0); an import/export adapter may come later.
- **D2** pnpm and Node are the reference runtime; bunx is supported.
- **D3** JSON config in `.demovie/config.json`.
- **D4** System ffmpeg; not bundled.
- **D5** Skill-first agent integration; `make` is only a convenience launcher.
- **D6** No telemetry.
- **D7** MIT license for everything in this repo.
- **D8** v1 captures are screenshots plus element maps; DOM snapshots come later.
