<!-- Generated from packages/cli/src/program.ts and packages/cli/src/help-examples.ts by scripts/build-docs.ts. Do not edit; run `pnpm docs:build`. -->
# Command reference

Every command, with its options and examples. The same examples appear under `npx demovie <command> --help`.
Run commands from your app's folder (the one with `.demovie/`), or point at it with `--cwd`.

| Command | What it does |
|---|---|
| [`init`](#demovie-init) | detect the app, extract brand/glossary/routes, set up demo mode + login, install the agent skill |
| [`doctor`](#demovie-doctor) | check Node, ffmpeg, ffprobe, Chromium, config, app reachability, auth and git |
| [`status`](#demovie-status) | project state and the next step |
| [`up`](#demovie-up) | start the app in demo mode (seed → start → wait) |
| [`down`](#demovie-down) | stop what `up` started |
| [`clean`](#demovie-clean) | free disk space: delete rendered frames in .demovie/.cache (the next render redraws them) |
| [`auth test`](#demovie-auth-test) | verify that login works |
| [`auth record`](#demovie-auth-record) | open a headed browser, log in manually, save the storage state |
| [`extract`](#demovie-extract) | re-run the extractors (static, plus runtime when the app is reachable) |
| [`glossary sync`](#demovie-glossary-sync) | regenerate glossary.json from glossary.md |
| [`capture`](#demovie-capture) | capture real screens, flows and element maps |
| [`flow new`](#demovie-flow-new) | scaffold a flow file |
| [`flow run`](#demovie-flow-run) | run a single flow |
| [`changes`](#demovie-changes) | summarize changes and affected routes |
| [`add`](#demovie-add) | import resources into .demovie/assets |
| [`new`](#demovie-new) | scaffold a video folder from a type preset and style template |
| [`preview`](#demovie-preview) | preview player with scrubbing, safe areas and QA overlay |
| [`stills`](#demovie-stills) | render still frames and a contact sheet |
| [`qa`](#demovie-qa) | run the QA rules |
| [`render`](#demovie-render) | render MP4s (and optional GIF/WebM) |
| [`audio music`](#demovie-audio-music) | synthesize music plus beats.json |
| [`audio sfx`](#demovie-audio-sfx) | list bundled SFX |
| [`audio voice`](#demovie-audio-voice) | synthesize voiceover lines from the storyboard (prints a cost estimate first) |
| [`audio mix`](#demovie-audio-mix) | mix music + VO + SFX and normalize loudness into mix.wav |
| [`make`](#demovie-make) | launch your own agent CLI with the demovie skill |
| [`mcp`](#demovie-mcp) | start the MCP server on stdio |
| [`skill install`](#demovie-skill-install) | install or update the Agent Skill (project-level by default) |
| [`ci init`](#demovie-ci-init) | write .github/workflows/demovie.yml (asks for confirmation) |

## Global options

These work with every command.

| Option | What it does |
|---|---|
| `-v, --version` | print the demovie version |
| `--cwd <dir>` | run as if demovie was started in <dir> |
| `--json` | machine-readable output on stdout; logs go to stderr |
| `--verbose` | print debug logs |
| `-y, --yes` | accept defaults and never prompt |
| `--no-color` | disable colors |

## Set up and check

Get a project ready and keep it healthy.

### demovie init

Detect the app, extract brand/glossary/routes, set up demo mode + login, install the agent skill.

```bash
npx demovie init [options]
```

| Option | What it does | Default |
|---|---|---|
| `--url <url>` | app URL; selects generic mode unless --framework nextjs is given |  |
| `--framework <name>` | skip detection and use this framework (one of: `nextjs`, `generic`) |  |
| `--app <path>` | app folder inside a monorepo |  |
| `--agents <list>` | agents to install the skill for, comma separated (claude,codex,cursor) |  |
| `--about <text>` | one-line product description used to seed glossary.md |  |
| `--start <command>` | command that starts the app (default: detected, e.g. next dev) |  |
| `--seed <command>` | command that loads demo data before captures |  |
| `--auth <strategy>` | how demovie logs in to the app (one of: `none`, `form`, `storageState`, `script`) |  |
| `--login-path <path>` | path of the login page (form login) |  |
| `--success-path <path>` | path the app opens after a successful login |  |
| `--no-extract` | skip brand/glossary/routes extraction |  |
| `--no-skill` | skip installing the agent skill |  |
| `--force` | regenerate an existing .demovie/config.json |  |

```bash
# Set up in a Next.js app (asks a few questions)
npx demovie init
# Any other web app, already running on a port
npx demovie init --url http://localhost:5173
# Non-interactive, for CI or scripts
npx demovie init --yes --agents claude
```

### demovie doctor

Check Node, ffmpeg, ffprobe, Chromium, config, app reachability, auth and git.

```bash
npx demovie doctor [options]
```

| Option | What it does | Default |
|---|---|---|
| `--fix` | install Chromium via Playwright and create missing folders |  |

```bash
# Check prerequisites, config, app and login
npx demovie doctor
# Install Chromium and create missing folders
npx demovie doctor --fix
```

### demovie status

Project state and the next step.

```bash
npx demovie status [options]
```

```bash
# What's captured, stale and rendered, and the next step
npx demovie status
```

### demovie up

Start the app in demo mode (seed → start → wait).

```bash
npx demovie up [options]
```

```bash
# Seed demo data, start the app and wait until it answers
npx demovie up
```

### demovie down

Stop what `up` started.

```bash
npx demovie down [options]
```

```bash
# Stop the app that `up` started
npx demovie down
```

### demovie clean

Free disk space: delete rendered frames in .demovie/.cache (the next render redraws them).

```bash
npx demovie clean [options]
```

| Option | What it does | Default |
|---|---|---|
| `--all` | also delete logs and other caches (never the voiceover cache) |  |
| `--dry-run` | show what would be deleted, and how much space it would free |  |

```bash
# See how much space the frame cache uses
npx demovie clean --dry-run
# Delete rendered frames (the next render redraws them)
npx demovie clean
# Also delete logs and other caches
npx demovie clean --all
```

## Log in

For apps with a login (see [capture and auth](capture-and-auth.md)).

### demovie auth test

Verify that login works.

```bash
npx demovie auth test [options]
```

```bash
# Log in with the configured strategy and report
npx demovie auth test
```

### demovie auth record

Open a headed browser, log in manually, save the storage state.

```bash
npx demovie auth record [options]
```

```bash
# Log in by hand once (OAuth, magic link, 2FA) and save it
npx demovie auth record
```

## Know the product

The brand, vocabulary and routes demovie reads from your code.

### demovie extract

Re-run the extractors (static, plus runtime when the app is reachable).

```bash
npx demovie extract [options] [what]
```

| Argument | What it is |
|---|---|
| `what` (optional) | brand \| glossary \| routes \| all |

```bash
# Re-extract everything after a redesign
npx demovie extract
# Only the brand (colors, fonts, logo)
npx demovie extract brand
```

### demovie glossary sync

Regenerate glossary.json from glossary.md.

```bash
npx demovie glossary sync [options]
```

```bash
# Rebuild glossary.json after editing glossary.md
npx demovie glossary sync
```

## Capture

Screenshots and element maps of the running app.

### demovie capture

Capture real screens, flows and element maps.

```bash
npx demovie capture [options]
```

| Option | What it does | Default |
|---|---|---|
| `--route <glob...>` | routes to capture, as paths or globs ("/app/*") |  |
| `--flow <name...>` | flows to run (names of files in .demovie/flows) |  |
| `--viewport <name...>` | viewports from the config, e.g. desktop or mobile |  |
| `--dark` | also capture dark mode |  |
| `--full-page` | also write full-page screenshots (for scrolling shots) |  |
| `--changed` | only re-capture states that are stale or that your code changes affect |  |
| `--since <ref>` | with --changed: git ref to compare against |  |

```bash
# Every route and flow
npx demovie capture
# One page on a phone, for a vertical video
npx demovie capture --route "/app/projects" --viewport mobile
# One flow, plus full-page screenshots
npx demovie capture --flow create-project --full-page
# Only what your recent code changes touched
npx demovie capture --changed --since v1.2.0
```

### demovie flow new

Scaffold a flow file.

```bash
npx demovie flow new [options] <name>
```

| Argument | What it is |
|---|---|
| `name` | flow name |

| Option | What it does | Default |
|---|---|---|
| `--start <path>` | page the flow starts on |  |
| `--ts` | write a TypeScript flow instead of YAML |  |

```bash
# Scaffold a YAML flow that starts on a page
npx demovie flow new create-project --start /app/projects
# A TypeScript flow, for logic YAML can't express
npx demovie flow new checkout --ts
```

### demovie flow run

Run a single flow.

```bash
npx demovie flow run [options] <name>
```

| Argument | What it is |
|---|---|
| `name` | flow name |

```bash
# Run one flow and capture its states
npx demovie flow run create-project
```

### demovie changes

Summarize changes and affected routes.

```bash
npx demovie changes [options]
```

| Option | What it does | Default |
|---|---|---|
| `--since <ref>` | git ref (default: latest tag, else the last 20 commits) |  |

```bash
# Commits and affected routes since the last tag
npx demovie changes
# Since a specific release, as JSON
npx demovie changes --since v1.2.0 --json
```

### demovie add

Import resources into .demovie/assets.

```bash
npx demovie add [options] <files...>
```

| Argument | What it is |
|---|---|
| `files` | files to import |

| Option | What it does | Default |
|---|---|---|
| `--describe <text>` | a short description your agent can read |  |
| `--licensed` | confirm you hold a license for imported audio |  |

```bash
# Import a product photo with a description
npx demovie add hero.jpg --describe "our office"
# Import a music track you have a license for
npx demovie add track.mp3 --licensed
```

## Make a video

Scaffold, look, check and render (your agent runs these for you).

### demovie new

Scaffold a video folder from a type preset and style template.

```bash
npx demovie new [options] <slug>
```

| Argument | What it is |
|---|---|
| `slug` | video slug |

| Option | What it does | Default |
|---|---|---|
| `--type <type>` | video type: sets the default length and formats (one of: `launch`, `feature`, `changelog`, `teaser`, `walkthrough`, `hero-loop`) |  |
| `--duration <seconds>` | duration in seconds |  |
| `--format <list>` | formats: 16:9,9:16,1:1,4:5 |  |
| `--style <style>` | style preset (look and motion) (one of: `clean`, `bold`, `soft`, `editorial`, `terminal`) |  |
| `--about <text>` | what the video is about |  |
| `--force` | overwrite an existing video folder |  |

```bash
# A 35 s launch video in 16:9 and 9:16
npx demovie new launch --type launch --about "the Projects board"
# A 12 s vertical teaser in the bold style
npx demovie new teaser --type teaser --format 9:16 --style bold
```

### demovie preview

Preview player with scrubbing, safe areas and QA overlay.

```bash
npx demovie preview [options] <slug>
```

| Argument | What it is |
|---|---|
| `slug` | video slug or path |

| Option | What it does | Default |
|---|---|---|
| `--port <port>` | port for the preview server | `4400` |
| `--no-open` | do not open the browser |  |

```bash
# Scrub the video in the browser, with safe areas and QA
npx demovie preview launch
```

### demovie stills

Render still frames and a contact sheet.

```bash
npx demovie stills [options] <slug>
```

| Argument | What it is |
|---|---|
| `slug` | video slug or path |

| Option | What it does | Default |
|---|---|---|
| `--at <times>` | times in seconds, comma separated |  |
| `--every <seconds>` | one still every N seconds |  |
| `--format <format>` | format (default: the first format) |  |
| `--sheet` | also write a contact sheet |  |
| `--scale <n>` | render scale (0.1–4) | `0.5` |

```bash
# Frames at given times, as a contact sheet
npx demovie stills launch --at 2,9.5,16 --sheet
# One frame per second in every format
npx demovie stills launch --every 1 --format all --sheet
```

### demovie qa

Run the QA rules.

```bash
npx demovie qa [options] <slug>
```

| Argument | What it is |
|---|---|
| `slug` | video slug or path |

| Option | What it does | Default |
|---|---|---|
| `--format <format>` | format or `all` | `all` |
| `--strict` | treat warnings as errors |  |
| `--fps <n>` | frames per second QA samples (default 10) |  |

```bash
# Run every QA rule on every format
npx demovie qa launch
# Fail on warnings too
npx demovie qa launch --strict
```

### demovie render

Render MP4s (and optional GIF/WebM).

```bash
npx demovie render [options] <slug>
```

| Argument | What it is |
|---|---|
| `slug` | video slug or path |

| Option | What it does | Default |
|---|---|---|
| `--format <format>` | format or `all` | `all` |
| `--quality <quality>` | draft is fast, for checking; final is for sharing (one of: `draft`, `final`) | `final` |
| `--scale <n>` | render scale (0.1–4) |  |
| `--fps <n>` | frames per second |  |
| `--gif` | also write preview.gif |  |
| `--webm` | also write a VP9 WebM |  |
| `--workers <n>` | parallel browser pages (default: from your CPU cores) |  |

```bash
# Final MP4s in every format
npx demovie render launch
# A quick draft while iterating
npx demovie render launch --quality draft --format 16:9
# Also a GIF and a WebM
npx demovie render launch --gif --webm
```

## Audio

Music, sound effects, voiceover and the final mix.

### demovie audio music

Synthesize music plus beats.json.

```bash
npx demovie audio music [options] <slug>
```

| Argument | What it is |
|---|---|
| `slug` | video slug or path |

| Option | What it does | Default |
|---|---|---|
| `--bpm <n>` | tempo (80–140) |  |
| `--mood <mood>` | mood preset (tempo and instruments) (one of: `uplifting`, `tech`, `calm`, `energetic`, `minimal`) |  |
| `--provider <provider>` | music provider (file = a track imported with add --licensed) (one of: `synth`, `elevenlabs`, `file`) |  |
| `--seed <seed>` | random seed (default: the video slug) |  |
| `--key <key>` | musical key, e.g. C, "F#m", "Eb major" (default: from the seed) |  |

```bash
# Synthesize a license-clean bed and beats.json
npx demovie audio music launch
# Pick the tempo and mood yourself
npx demovie audio music launch --bpm 112 --mood energetic
```

### demovie audio sfx

List bundled SFX.

```bash
npx demovie audio sfx [options]
```

| Option | What it does | Default |
|---|---|---|
| `--list` | list the bundled SFX |  |

```bash
# List the bundled sound effects
npx demovie audio sfx --list
```

### demovie audio voice

Synthesize voiceover lines from the storyboard (prints a cost estimate first).

```bash
npx demovie audio voice [options] <slug>
```

| Argument | What it is |
|---|---|
| `slug` | video slug or path |

| Option | What it does | Default |
|---|---|---|
| `--provider <provider>` | text-to-speech provider (with your own API key) (one of: `elevenlabs`, `openai`) |  |
| `--voice <id>` | the provider's voice id |  |
| `--model <id>` | the provider's model id |  |
| `--script <file>` | VO script instead of the storyboard (one line per VO line, optional `[12.5]` start) |  |

```bash
# Estimate the cost of the voiceover first
npx demovie audio voice launch
# Synthesize it once you accept the estimate
npx demovie audio voice launch --yes
```

### demovie audio mix

Mix music + VO + SFX and normalize loudness into mix.wav.

```bash
npx demovie audio mix [options] <slug>
```

| Argument | What it is |
|---|---|
| `slug` | video slug or path |

```bash
# Mix music, voice and SFX to −16 LUFS
npx demovie audio mix launch
```

## Agents

Hand the work to your coding agent.

### demovie make

Launch your own agent CLI with the demovie skill.

```bash
npx demovie make [options]
```

| Option | What it does | Default |
|---|---|---|
| `--agent <agent>` | agent CLI to launch (default: the first one installed) (one of: `claude`, `codex`, `cursor`, `custom`) |  |
| `--agent-cmd <template>` | custom agent command, e.g. "mytool run {prompt}" |  |
| `--model <model>` | model passed to the agent |  |
| `--type <type>` | video type: sets the default length and formats (one of: `launch`, `feature`, `changelog`, `teaser`, `walkthrough`, `hero-loop`) |  |
| `--duration <seconds>` | duration in seconds |  |
| `--format <list>` | formats, comma separated (16:9,9:16,1:1,4:5) |  |
| `--about <text>` | what the video is about |  |
| `--resources <files>` | files the agent should use (notes, a script, assets), comma separated |  |
| `--voice` | add a voiceover (paid, with your own provider key) |  |
| `--review` | review the brief and storyboard before animating |  |
| `--no-review` | work without stopping for your review |  |
| `--dry-run` | print the exact agent command and exit |  |

```bash
# Ask your agent for a launch video (it asks you to review the plan)
npx demovie make --about "the Projects board"
# A short vertical teaser, without stopping for review
npx demovie make --type teaser --format 9:16 --no-review
# See the exact agent command without running it
npx demovie make --agent codex --dry-run
```

### demovie mcp

Start the MCP server on stdio.

```bash
npx demovie mcp [options]
```

```bash
# Start the MCP server (your agent's MCP config runs this)
npx demovie mcp
```

### demovie skill install

Install or update the Agent Skill (project-level by default).

```bash
npx demovie skill install [options]
```

| Option | What it does | Default |
|---|---|---|
| `--agent <list>` | agents to install for, comma separated (claude,codex,cursor) |  |
| `--global` | install into the user-level skill folder (explicit request only) |  |

```bash
# Install or update the skill for your agents in this project
npx demovie skill install
# Only for Codex
npx demovie skill install --agent codex
```

## Continuous integration

A video for every release.

### demovie ci init

Write .github/workflows/demovie.yml (asks for confirmation).

```bash
npx demovie ci init [options]
```

| Option | What it does | Default |
|---|---|---|
| `--provider <provider>` | CI provider (one of: `github`) | `github` |

```bash
# Write a GitHub workflow that makes a clip on every release
npx demovie ci init
```

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | The command failed, or QA found errors |
| 2 | Usage or config error |
| 3 | A prerequisite is missing (Node, ffmpeg, Chromium) |
| 4 | The app is unreachable, or login failed |

With `--json`, output is one JSON document on stdout and errors are
`{ "ok": false, "error": { "code", "message", "fix" } }`. Logs always go to stderr.
