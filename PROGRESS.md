# Progress

This checklist mirrors SPEC §20; if they conflict, SPEC wins. Tick a box only once the thing is verified, and add a short note with evidence: a command, a number, or a path.

| Milestone | Status | Commit |
|---|---|---|
| M0 Scaffold | done | `7c5e7b1` |
| M1 Core & init | done | `3a8d7f2` |
| M2 Capture | done | `068532d` |
| M3 Runtime, renderer, preview, stills | done | `5d43820` |
| M4 QA | done | `35fa823` |
| M5 Audio | done | `83e76e6` |
| M6 Agent layer | done | `5ed6603` |
| M7 Changelog & CI | done | `90013e4` |
| M8 Dogfood | done | `446f247` |
| M9 Docs & release readiness | done | see `git log` (`feat(m9)`) |

## M0 — Scaffold
- [x] Git repo initialized; monorepo per SPEC §5 (pnpm, TS strict, Biome, vitest, tsdown) — `pnpm-workspace.yaml` (packages/* + examples/harborly), `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`), `biome.json`, `vitest.config.ts` (unit + integration projects), `packages/cli/tsdown.config.ts`
- [x] CI workflow, LICENSE (MIT), CODE_OF_CONDUCT, SECURITY — `.github/workflows/ci.yml` runs `pnpm verify` on ubuntu-latest + macos-latest, Node 22; Contributor Covenant 2.1
- [x] `scripts/verify.ts` with the full check table (unimplemented = `pending`) — 14 checks from SPEC §18; M0 run: 5 pass, 9 pending (see below)
- [x] `examples/harborly` works: dev server, login, demo seed (SPEC §16.1) — Next 16.3.8 App Router, 12 pages + 2 route handlers, HMAC cookie session (`node:crypto`) with `src/proxy.ts` matcher `/app/:path*`; `pnpm --filter harborly demo:seed` is deterministic; `next build` clean; 25 functional checks (login/redirects/create-project/logout) and 43 reviewed screenshots (light, dark, mobile, empty states)
- [x] Built CLI runs `demovie --version` and `--help` — `node packages/cli/dist/index.js --version` → `0.1.0`; `--help` lists every SPEC §7 command; unknown commands exit 2

## M1 — Core & init
- [x] zod schemas for all `.demovie/` files + generated JSON Schemas — 18 schemas in `packages/core/src/schemas/` (config, brand, glossary, routes, flow, assets, video, brief, storyboard, beats, voice, provenance, qa, capture-index, elements, capture-meta, flow-run, changes); `z.toJSONSchema` writes `packages/cli/schema/*.schema.json` at build (published with the package)
- [x] Detection, route discovery, brand, glossary, metadata extractors — static (esbuild + acorn, never executes project code) and runtime (Playwright: computed styles, same-origin fonts, header logo, crawl); fixtures in `packages/core/test/fixtures/` cover monorepos, route groups, parallel/intercepting routes, `[[...slug]]`, basePath/i18n, oklch tokens, local fonts
- [x] `init` (interactive + `--yes`), `doctor [--fix]`, `status`, `extract`, `glossary sync` — interactive init driven through a pseudo-TTY (prompts → `.demovie/.env` + `.auth/state.json`); `--yes` covered by unit + integration tests; glossary edits survive re-extraction
- [x] Harborly: valid config/brand/glossary/routes; correct primary color, Geist fonts, logo; ≥ 10 routes with correct `protected` flags — `packages/cli/test/init.int.test.ts`: primary `#155dfc` (css-var `--primary`, runtime-confirmed), Geist / Geist Mono with woff2 files, `logo-mark.svg` + `logo.svg`, 12 routes (7 protected via `src/proxy.ts` matcher `/app/:path*`, `[id]` params filled by the logged-in crawl), 7 people + 17 entities from the seed file
- [x] pages-minimal and static-site fixtures detected correctly — Pages Router + Tailwind v3 (`hsl(var(--primary))` → `#10b77f`), and generic mode with crawl-only routes (`packages/cli/test/generic.int.test.ts`; logout/delete links never followed)

## M2 — Capture
- [x] `up`/`down`, seed, frozen clock, hide/block requests — `packages/capture/test/lifecycle.int.test.ts` (seed → start → ready → reuse → tree-kill; failing start prints the app log + fix); `page.clock.setFixedTime(demo.now)`; capture CSS hides `demo.hide` + Next dev indicators (verified in screenshots: no cookie banner, no "N" bubble)
- [x] Auth: none, form, storageState (`auth record`), script; `auth test` — `packages/capture/test/auth.int.test.ts` (form, storageState from a saved state, `.demovie/auth.ts` script, wrong password → `E_AUTH` + fix); `auth test` prints cookie names only (`harborly_session`)
- [x] Route capture, flows (YAML + TS), element maps, redaction, freshness, `--changed` — `packages/capture/test/capture.int.test.ts` (7 tests) + unit tests for element maps/redaction in real Chromium; touching `src/app/app/team/page.tsx` makes exactly `routes/app-team@desktop` stale and `capture --changed` re-captures only it
- [x] Harborly: all static routes + `[id]` + `create-project` flow (desktop) + 2 mobile routes — 12 route states (`[id]` → `prj_launch`) + 6 flow states (`board, dialog, dialog-filled, created, checklist-hover, board-after`) + `routes/index@mobile`, `routes/app-projects@mobile` (1170×2532); flow.json records `link:new-project` / `textbox:project-name` / `button:create-project` with boxes from the latest captured state
- [x] Element ids stable across two runs; settings email/API key redacted — 640 ids in 18 element maps identical across two captures; `maya.chen@acme-rockets.example` → `morgan.blake@example.org`, `sk_live_…` → `sk_live_••••` (meta.redactions `{email: 1, secret: 1}`)
- [x] Capture within budget (time: 9.3 s) — all 12 routes + the create-project flow at desktop (2×) in 9.0–9.3 s against a warm `next dev` (budget 60 s); a cold start of `next dev` adds ~2 s

## M3 — Runtime, renderer, preview, stills
- [x] `clock.js` + runtime API (screen, cursor, typeText, text, callout, captions, transition, logo) + style CSS — `packages/runtime` (14.4 KB min+gz, budget 60 KB); `packages/render/test/runtime.test.ts` covers the clock (performance.now/Date/rAF/seeded random/timers after ready), order-independent seeks, inspect(), nearest-id errors, stray tweens, and every helper (callout, counter, karaoke captions, all 5 transitions, logo); 5 style presets in `packages/runtime/styles/`
- [x] Renderer, stills + contact sheet, preview server with hot reload, `new` scaffolding — `packages/render` (sandboxed 127.0.0.1 server, CDP frame stepping with N workers + resume, x264/BT.709/AAC encode, GIF/WebM, posters); `render.int.test.ts` (draft + final × 2 formats, stills + sheet, preview SSE reload); `new` + `add` unit tests
- [x] `examples/compositions/clean-launch` renders 16:9 + 9:16 final MP4s; ffprobe assertions pass — `pnpm verify` check 8: `clean-launch-16x9.mp4` h264 High yuv420p 1920×1080 30 fps 35.000 s + AAC 48 kHz stereo, BT.709; `clean-launch-9x16.mp4` 1080×1920, same
- [x] Determinism tests pass — same frame twice and shuffled seek orders are byte-identical (synthetic composition and clean-launch at 6.9/11.8/14.6/31.2 s); golden stills match (pixelmatch)
- [x] Budgets: stills 2.6 s · draft 11.4 s · final 62 s (clean-launch is 35 s, longer than the 30 s budget video: `stills --every 1` 35 stills in 2.6 s < 20 s; `render --quality draft` 16:9 in 11.4 s < 60 s; `render --quality final` one format in 62 s < 4 min)

## M4 — QA
- [x] Every rule in SPEC §12 with passing + failing synthetic tests — `packages/qa/src/rules.ts` (30 rules, each with measurement + fix); `packages/qa/test/rules.test.ts`: 34 tests (one passing and one failing synthetic case per rule, a clean baseline, strict/waivers, reading-time and entrance-frame edge cases)
- [x] `qa.json`, fix hints, waivers, `--strict`, preview QA overlay — `demovie qa <slug> [--format f|all] [--strict] [--fps n]` writes `qa.json` (SPEC §12 structure + `until` spans) and exits 1 on errors; `video.json qa.ignore` → `waived`; `packages/qa/test/qa.int.test.ts` opens the preview player and finds the DM-T02 overlay box
- [x] `clean-launch` passes with 0 errors; each `bad-*` fixture triggers its intended rules — `pnpm verify` check 7: clean-launch 0 errors / 0 warnings in 16:9 and 9:16; 9 fixtures (bad-text, bad-layout, bad-pacing, bad-truth, bad-assets, bad-determinism, bad-ai-look, bad-loop, bad-audio) trigger all 30 intended rules (run with `--strict` so warn-level targets count)

## M5 — Audio
- [x] Music synth + `beats.json`; SFX generation script + bundled set — `packages/audio/src/music.ts`: pure-TS DSP (kick, clap, hats/shaker, saw/sine bass, detuned-saw pad, pluck arp, riser/crash/boom, reverb, ping-pong delay, look-ahead limiter), 5 moods, sections from the storyboard with the ending hit on a bar line; 35 s of 48 kHz stereo in ~0.9 s; `demovie audio music` writes music.wav + beats.json + provenance and wires video.json. `scripts/generate-sfx.ts` (`pnpm sfx:generate`) → 12 CC0 SFX in `packages/audio/sfx` (1.6 MB). Unit tests: duration, sample rate, peak level, determinism per seed, beat grid, per-mood arrangement, bundled SFX == generator output. Spectrograms of every mood and the SFX set reviewed.
- [x] Voice providers (mocked HTTP tests), cache, cost estimate — ElevenLabs (with-timestamps → word timings) and OpenAI (WAV, estimated words) behind `VoiceProvider`; `packages/audio/test/voice.test.ts` checks request URLs/headers/bodies, alignment → words, cost tables, 401 → fix hint without the key, cache hits; `audio.int.test.ts` runs `audio voice` with a stubbed fetch (no key → exit 2 with fix; no `--yes` → exit 2; cached re-run makes no requests). Live tests (`voice.live.int.test.ts`) skip with "skipped unless ELEVENLABS_API_KEY / OPENAI_API_KEY is set".
- [x] Captions (VTT/SRT + runtime), mix + ducking + loudnorm, provenance + DM-A04 — shared cue splitting (runtime `cues.ts` ↔ `audio/captions.ts`, parity test); `audio voice` writes captions.vtt/srt, render copies them to out/; `audio mix`: −8 dB duck (150 ms / 400 ms), 1 s fade-out, two-pass linear loudnorm, 48 kHz stereo; every generator appends provenance (idempotent, sha256); DM-A04 also checks licensed asset music
- [x] `clean-launch` renders with music + SFX; loudness within target ± 1 LU (measured: −15.8 LUFS integrated, −2.3 dBTP true peak in both MP4s; mix.wav −15.7 LUFS) — `pnpm verify` check 8 asserts it; clean-launch has uplifting synth music at 112 BPM plus 16 SFX cues (whooshes on cuts, clicks, key presses, a shimmer on the logo)
- Audio timings: `audio music` 35 s synth in 1.1 s wall (0.9 s DSP); `audio mix` (16 cues, two-pass loudnorm) in 2.4 s

## M6 — Agent layer
- [x] SKILL.md + references + 5 style docs; one reference composition per style, all passing QA — `packages/skill/demovie/SKILL.md` (224 lines: preflight → brief → capture plan → storyboard → style frames → animate → QA loop → render → report, hard rules, the "AI look" list, rubric), references (runtime-api.md and qa-rules.md generated from the code, motion, pacing/formats, brief + storyboard templates, flows, audio, troubleshooting, `styles/{clean,bold,soft,editorial,terminal}.md`, 5 annotated examples). Reference compositions `examples/compositions/{clean,bold,soft,editorial,terminal}-launch` (28–35 s, synth music + SFX): `pnpm verify` check 7 → 0 errors / 0 warnings in 16:9 and 9:16 for all five; contact sheets in `<name>/out/stills/{16x9,9x16}/sheet.png` reviewed. Building them surfaced and fixed: `transition.wipe` not interpolating (unitless `inset()`), `inspect()` counting text hidden by a mask reveal, three preset classes under 4.5:1 contrast, and soft.css overriding phone frame radii.
- [x] `skill install`; plugin + marketplace manifests; `npx skills add` compatible — `demovie skill install [--agent …] [--global]` (project `.claude/skills/demovie` + `.agents/skills/demovie` by default; tests incl. `--global` into a temp HOME); `plugins/demovie` (plugin.json, `.mcp.json` → `npx -y demovie mcp`, generated skill copy) and `.claude-plugin/marketplace.json` pass `claude plugin validate --strict`; the skills CLI's documented marketplace discovery finds `plugins/demovie/skills/demovie` (verify check 11)
- [x] MCP server with all tools; smoke test passes — 15 tools (status, init_check, extract, list_routes, list_captures, capture, get_elements, new_video, stills with image content, qa, audio_music, audio_voice with `confirm`, audio_mix, render, changes) with progress notifications; `packages/mcp/test/mcp.int.test.ts` and verify check 9 (SDK client over stdio against the built CLI: 15 tools, status, a PNG contact sheet)
- [x] `make` adapters (claude, codex, cursor, custom), interactive + headless; `--dry-run` verified against the real CLIs' `--help` — `packages/cli/src/adapters/*`; `packages/cli/test/make.test.ts` checks every adapter's interactive/headless arguments, the SPEC prompt, `--dry-run` output, exit-code passthrough, and greps the installed `claude` 2.1.247, `codex` 0.156.1 and `cursor-agent` 2026.10.01 `--help` for every flag used (DECISIONS)

## M7 — Changelog & CI
- [x] `changes` with import-graph route mapping; `capture --changed` — `packages/core/src/changes/` (conventional commits + PR numbers, optional `gh` details, three-dot diff scoped to the app folder, a static reverse import graph with tsconfig `paths`, depth 6, direct vs import reasons with the `via` chain, capture/flow/story suggestions) → `.demovie/.cache/changes.json`; `capture --changed --since <ref>` re-captures stale states plus routes and flows affected by commits and uncommitted changes. Unit tests: commit parsing, story line, JSONC, alias resolution, Harborly graph (`packages/core/test/changes.test.ts`)
- [x] GitHub Action + `ci init` — `packages/action/action.yml` (composite; inputs agent, agent-version, type, formats, since, app-url, start, working-directory, comment, upload-release-asset) + dependency-free `scripts/demovie-action.mjs` (install-agent, run, report; Vercel bypass headers; PR comment, release assets, job summary; dry-run and local modes); `demovie ci init` writes `.github/workflows/demovie.yml` at the git root (release + workflow_dispatch, commented deployment_status) after confirmation. verify check 12 validates action.yml against its zod schema (declared inputs, pinned actions, existing scripts) and dry-runs the scripts against Harborly
- [x] Harborly test branch: correct affected routes; action scripts run locally end-to-end with the mocked agent — Harborly's shared HealthBadge now shows an icon per health; `packages/cli/test/changes.int.test.ts` replays it as `feat(projects): health badges show an icon (#42)` on a branch over the previous version in a temp git repo → exactly /app, /app/projects, /app/projects/[id], /app/projects/new via the import graph, flow `create-project`, story "1 user-visible change: health badges show an icon."; `packages/action/test/action.int.test.ts` runs `run` + `report` against Harborly with a mock agent that copies clean-launch, passes QA and renders a draft clip (summary, outputs, comment checked)

## M8 — Dogfood
- [x] Launch video (30–40 s, 16:9 + 9:16, `clean`), QA 0 errors — `examples/harborly/.demovie/videos/launch` ("Harborly — Projects board", made by following SKILL.md from `demovie new launch --type launch --style clean --about "The Projects board"`): 35 s at 112 bpm with cuts on bar lines, synth music + 21 CC0 SFX cues, no VO (no keys, no paid calls). Every product shot is a real capture (`routes/app-projects@desktop` and the 4 states of the `create-project` flow) with camera, cursor and rings on element-map ids. `demovie qa launch --format all` → 0 errors, 0 warnings; mix −15.7 LUFS / −2.5 dBTP; `out/launch-16x9.mp4` 1920×1080 and `out/launch-9x16.mp4` 1080×1920 (5.9 / 4.4 MB; final render 64.7 s for 16:9, budget 4 min); `share.md` written
  - Rubric (clarity / truth / pacing / hierarchy / brand / motion / polish / ending): 5 / 5 / 4 / 4 / 5 / 4 / 4 / 5 — from the contact sheets: pacing −1 for two holds with little change (the created page 19–21 s, the timeline 24–26 s); hierarchy −1 because in 9:16 the product frame fills only about a third of the height and the full-board resets (9–10 s, 27 s) are too small to read, and the New project dialog stays about a third of the 16:9 frame wide while typing; motion −1 for the back-and-forth return to the full board between the column tour and the health zoom; polish −1 for the 16:9 timeline push-in leaving the left half of the frame mostly empty
  - Contact sheets: `examples/harborly/.demovie/videos/launch/out/stills/16x9/sheet.png`, `examples/harborly/.demovie/videos/launch/out/stills/9x16/sheet.png` (reviewed; outputs are gitignored, `pnpm verify:dogfood` checks the MP4s)
- [x] Changelog clip (12–18 s), QA 0 errors — `examples/harborly/.demovie/videos/changelog`: 15 s, 16:9 + 1:1, covering the M7 change ("Health badges now show an icon": board cards with rings on the At risk / Off track projects, then the same badges on the dashboard's upcoming launches); `demovie qa changelog --format all` → 0 errors, 0 warnings; `out/changelog-16x9.mp4` (2.0 MB, final render 31.5 s) and `out/changelog-1x1.mp4` (1.7 MB)
- [x] Baseline one-prompt video + `docs/media/grounded-vs-generic.mp4` + `.gif` (≤ 8 MB) — `examples/baseline-one-prompt` (30 s, no captures, UI redrawn from imagination, invented metrics, HUD clichés, logo-only ending; QA fails on it by design); `pnpm comparison:build` (`scripts/build-comparison.ts`) → `docs/media/grounded-vs-generic.mp4` (1920×640, 35 s, 3.3 MB, labelled "One prompt, no captures" / "demovie: real captures, checked by QA") and `docs/media/grounded-vs-generic.gif` (960 px, 10 fps, 14 s excerpt, 2.4 MB)
- [x] Friction log below: every item fixed or explicitly deferred — 8 fixed (with tests), 1 deferred (app-side)

### Friction log
- **F1** — `status`: `"skill": []` but no warning that the project's agents have no demovie skill. **Fixed:** a warning names the agents and the fix (`npx demovie skill install`, or the plugin); `status` also reports the grounding level, L0 (brand only) to L3 (flows captured) — `packages/cli/test/status.test.ts`.
- **F2** — `status`: the next step pointed at a `/demovie make` slash command that doesn't exist. **Fixed:** "ask your agent for a video (…), or run `npx demovie make --type launch`" — `status.test.ts`.
- **F3** — `new --about "The Projects board"` still started from the dashboard capture; the capture pick ignored `--about`. **Fixed:** pages whose path or headings match the `--about` words are picked first — `packages/cli/test/new-add.test.ts`.
- **F4** — Skill: SKILL.md generated music in step 6, after animating, but `v.beat()`/`v.bar()` need `audio/beats.json` while animating. **Fixed:** step 4 now says to run `npx demovie audio music <slug>` as soon as the storyboard has a bpm (plugin copy regenerated).
- **F5** — Element map: Harborly's health badges have no element of their own (they sit inside the card link), so a ring can only target the whole card. **Deferred:** app-side; the fix is a `data-demovie` id on the badge, which the skill tells the agent to propose rather than add unasked. The changelog clip frames part of the row rect instead.
- **F6** — `init`/`new`: `$schema` always pointed at `node_modules/demovie/…`, even when demovie isn't installed, and config.json's path was relative to the project root rather than to the file. **Fixed:** `schemaRef()` writes the path to the installed package's schema relative to the file, otherwise the unpkg URL for this version (SPEC §6.1) — `init.test.ts`, `new-add.test.ts`.
- **F7** — `changes` (bug): in a monorepo (app below the git root) it found 0 commits, because git pathspecs are relative to the app folder it runs in. **Fixed:** scope with `.` and read paths with `--full-name` — monorepo case in `packages/cli/test/changes.int.test.ts`.
- **F8** — QA DM-T01 counted a lone "—" as a word, which inflated reading time. **Fixed:** punctuation-only tokens don't count — `packages/render/test/runtime.test.ts`.
- **F9** — Runtime: every composition hand-rolled a `union()` of rects to frame a heading plus its cards. **Fixed:** `screen.rect(...ids)` returns the box around several elements; the six compositions use it (QA unchanged, stills identical) — `runtime.test.ts`.

## M9 — Docs & release readiness
- [x] All docs (SPEC §19); README with the GIF; generated config + QA-rule docs — `README.md` (hero GIF → MP4, pitch, 3-command quickstart, mermaid "how it works", features, supported-agents table, examples gallery from `pnpm gallery:build`, the four FAQ answers, docs index, contributing, license); `docs/` getting-started, concepts (grounding levels L0–L3, also reported by `status`), config (generated), capture-and-auth, demo-data, compositions (generated runtime API), styles, qa-rules (generated), audio, agents, ci, licensing-and-terms (GSAP and Remotion terms checked 2026-10-02), troubleshooting, faq; `LICENSE` (MIT), `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `CONTRIBUTING.md` (setup, verify, regenerating the examples, adding a QA rule / style / agent adapter), `SECURITY.md`, issue + PR templates, `CHANGELOG.md`. `pnpm docs:build` regenerates config.md (every field described in the zod schema), qa-rules.md and compositions.md; verify check 13 → 16 docs, 50 links resolve, 22 CLI commands mentioned (all in `--help`), generated docs up to date
- [x] changesets configured; `release.yml` prepared (not run); version 0.1.0 — `@changesets/cli` 3.0.3 with `.changeset/config.json` (`demovie` + `@demovie/runtime` fixed, public; private workspace packages not versioned) and `pnpm changeset`; `changeset status` reads the config; `CHANGELOG.md` → `packages/cli/CHANGELOG.md` and `packages/runtime/CHANGELOG.md` (0.1.0); `.github/workflows/release.yml` (verify, then changesets/action with npm provenance) only runs on main when the `DEMOVIE_RELEASES` repository variable is `enabled`, and never ran (no remote); every package is 0.1.0 and `demovie --version` → 0.1.0
- [x] Tarball smoke test via npx (and bunx if available) — verify check 14: `demovie-0.1.0.tgz` unpacked 2.5 MB (< 15 MB); `npx demovie --version` → 0.1.0, `doctor --json` ok, `init --yes` on a Harborly copy ok; `bunx demovie --version` → 0.1.0 and `doctor` with bun 1.2.4
- [x] `pnpm verify` + `pnpm verify:dogfood` pass; `git status` clean — after the last change: `pnpm verify` → `VERIFY OK (14 checks)`, none pending, the only skips being the 2 live paid-API tests without keys; `pnpm verify:dogfood` → `VERIFY DOGFOOD OK (8 checks)` with ffprobe summaries and 0 QA errors for launch (16:9, 9:16) and changelog (16:9, 1:1); `git status --porcelain` empty; `git log --oneline` shows `feat(m0)` … `feat(m9)`

## Post-M9 — Production hardening and a second real app (Bite Club)
Decisions D113–D135. Every fix below has a unit test unless noted.
- [x] Security:
  - render sandbox: no network beyond 127.0.0.1, no WebSockets or WebRTC; the static server checks real paths and the Host header (`packages/render/test/sandbox.test.ts`);
  - secret masking in all JSON, errors and MCP output (`output.test.ts`, `mcp-handlers.test.ts`);
  - app headers scoped to the app origin (`headers.test.ts`), saved login state filtered to the app's site (`same-site.test.ts`), `.env` written 0600 (`fs.test.ts`);
  - redaction of shadow roots, iframes, hrefs and titles (`element-map.test.ts`);
  - `make` refuses nested runs and passes Claude deny rules (`make.test.ts`); paid calls need an explicit `--yes` (`context.test.ts`).
- [x] Robustness:
  - `down` only kills the process it started (`same-process.test.ts`);
  - the frame cache is keyed on everything a frame depends on, written atomically and pruned (`frames.test.ts`);
  - capture can't hang on lazy images, and captures the full page of app shells (`element-map.test.ts`);
  - unique capture job ids; route detection for i18n proxies and `[locale]` layouts (`detect.test.ts`);
  - `changes` at a tag and in an empty repository (`changes.test.ts`);
  - numeric CLI flags range-checked, with `--json` usage errors (checked by hand: `--fps abc` and `--scale 0` exit 2, and with `--json` print `E_USAGE`).
- [x] Determinism: a frame depended on the frame rendered before it, because Chromium caches the raster of `will-change` layers (Bite Club, t=15 s). The cursor no longer sets it, and DM-R01 now renders the frame before each sample first, so it catches this.
- [x] Packaging:
  - `@demovie/runtime` ships types; `demovie/flow` exports `defineFlow` with types (`flow-types.test.ts` type-checks a consumer);
  - package metadata points at `enszrlu/demovie`;
  - `doctor` launches Chromium, with an install-deps hint for Linux (`launch-failure.test.ts`).
- [x] CI and release:
  - actions moved to their Node 24 majors;
  - CI checks that generated files are committed, and runs a Node 20.19 build job;
  - `release.yml` splits verify (read-only) from release and publishes with npm trusted publishing (OIDC);
  - the action finds monorepo lockfiles, installs the Chromium of the demovie that runs, and reports workspace-relative outputs (`packages/action/test/action.test.ts`).
- [x] Friction F5 fixed: Harborly's health badges carry `data-demovie="health-<id>"`. Both Harborly videos were re-captured and re-rendered: the changelog rings sit on the badges themselves, and the launch video has the new phone status band.
- [x] Bite Club example: in the Bite Club repository's `.demovie/` folder (outside this repository, untracked there), with no app code changed.
  - **Setup:** a real Next.js 16 app with i18n and three roles, logged in with its seed test accounts.
  - **Captures:** employee screens (Weekly Menu Selection, the pickup QR code) and kitchen screens (Distribution, Today's Menu Details) on phone and laptop.
  - **The video:** "Bite Club — Stop guessing. Start counting.", made by following SKILL.md: 35 s at 112 bpm, 16:9 + 9:16, synth music and SFX, no VO.
  - **Outputs:** `out/launch-16x9.mp4` 1920×1080 (3.5 MB) and `out/launch-9x16.mp4` 1080×1920 (3.6 MB), BT.709, mix −15.8 LUFS / −2.2 dBTP.
  - **QA:** `demovie qa launch --format all` gives 0 errors and 1 warning per format (DM-A01: the brand's JetBrains Mono is declared but unused).
  - **Friction found and fixed:**
    - **F10** — capture hung on lazy offscreen images;
    - **F11** — every route was marked protected (i18n catch-all proxy);
    - **F12** — no root layout found under `[locale]`;
    - **F13** — the logo SVG had no viewBox and used JSX attribute names;
    - **F14** — `text.reveal` dropped accent spans;
    - **F15** — the phone's dynamic island covered the page;
    - **F16** — rings couldn't frame a row that has no element (`highlight(rect)`);
    - **F17** — full-page captures of app-shell scrollers were viewport-only;
    - **F18** — the determinism bug above;
    - **F19** — an unused brand font failed QA (now a warning);
    - **F20** — Turbopack stalled on start (troubleshooting entry; the example uses `next dev --webpack`).
- [x] Two problems found by this repository's own verify, both fixed:
  - **F21** — vitest's `NODE_ENV=test` reached `next dev`, which then rewrote Harborly's tsconfig.json (D134; `child-env.test.ts`);
  - **F22** — the new MCP project boundary refused the smoke test's `../compositions/clean-launch`, so the smoke test now uses the project's own slug (D135).
- [x] `pnpm verify` → `VERIFY OK (14 checks)`, none pending:
  - 188 unit tests and 27 integration tests; the only skips are 2 live paid-API tests without keys;
  - reference compositions QA 0 errors, 0 warnings;
  - MCP smoke: stills returns a 31 KB PNG.
- [x] `pnpm verify:dogfood` → `VERIFY DOGFOOD OK (8 checks)`: Harborly launch (16:9, 9:16; re-rendered in 63.5 s and 73.7 s against the 4 min budget) and changelog (16:9, 1:1), QA 0 errors and 0 warnings on all four.

## Launch readiness
Decisions D138–D143.
- [x] `make` in headless runs:
  - prints one line per agent step, keeps the raw stream in `.demovie/.cache/make/`, and ends with time, turns, the agent's reported cost and the MP4s written;
  - in a folder without `.demovie/`, it runs `init` first.
  - Tests: `agent-progress.test.ts`, `make.test.ts` (a fake Claude stream, and auto-init on `pages-minimal`).
  - **Real run** on a copy of Harborly with the packed CLI (`npx demovie make --type teaser --format 16:9 --yes`, Claude Opus 5.5): 3 min 21 s, 43 turns, $1.06, a 12 s teaser with QA 0 errors and 0 warnings. It is now `examples/harborly/.demovie/videos/projects-board-teaser`.
- [x] `demovie clean` frees the frame cache; `status` warns past 2 GB (`clean.test.ts`). On Harborly it freed 7.2 GB.
- [x] Story-first skill: the brief has an Angle and a Hook (first 2 seconds), the rubric scores the hook, and long commands run in the foreground. The real run above filled both sections: angle "Launch plans scatter; Harborly puts every launch on one board…", hook "Every launch. One board."
- [x] Examples under every command's `--help`; a test checks that every example uses real flags. Option descriptions explain themselves; `demovie --help` ends with the three getting-started commands.
- [x] Docs for people:
  - **Pages:** docs home, step-by-step tutorial, five guides (logins, flows, follow-up videos, releases, by hand), recipes, a generated command reference (`docs/cli.md`), and the comparison page.
  - **Testing:** the by-hand guide's code was rendered and QA'd on Harborly.
  - **Outputs shown:** the `make` output in the docs comes from the real run.
- [x] Comparison with brag, Remotion, HyperFrames and plain prompting: facts checked 2026-10-02; four approaches measured on a private Next.js app (reported anonymously).
- [x] README: an honest hero caption, "How it compares", a brag FAQ entry, the reorganized docs list and the teaser example; npm keywords added.
- [x] Public side-by-side on Harborly (`docs/media/comparison/harborly-brag-vs-demovie.{gif,mp4}`):
  - **brag:** 39 min, 108 turns, $12.26 for 21.5 s, from the bare repository at maximum effort.
  - **demovie `make`:** 3 min 21 s, 43 turns, $1.06 for 12 s, in a project already set up, at the default effort.
  - **Disclosed on the page (D144):** both run differences, and that brag used Harborly's real demo data.
- [x] DM-R01 no longer fails at random on Linux CI (D145): it compares full-size captures from two fresh pages, the way final renders capture, and fails on visible differences. `bad-determinism` still fails (1.46% of pixels, largest change 234 of 255). clean-launch and terminal-launch pass on macOS and in the Playwright Linux image with three QA runs in parallel. Cost: +0.7 s per format.
- [x] macOS CI no longer times out on a second `capture` in a row (D146): stopping the app waits for its whole process group, and a port already held by another server is an immediate, explained error. Two new lifecycle integration tests fail on the old code and pass now.
- [x] Final checks, with nothing else running:
  - `pnpm verify` → `VERIFY OK (14 checks)`: 199 unit tests, 29 integration tests (the only skips are 2 paid-API tests without keys), reference compositions QA 0 errors, 26 docs and 149 links;
  - `pnpm verify:dogfood` → `VERIFY DOGFOOD OK (8 checks)`.
