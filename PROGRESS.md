# Progress

This checklist mirrors SPEC §20; if they conflict, SPEC wins. Tick a box only once the thing is verified, and add a short note with evidence: a command, a number, or a path.

| Milestone | Status | Commit |
|---|---|---|
| M0 Scaffold | done | `7c5e7b1` |
| M1 Core & init | done | `3a8d7f2` |
| M2 Capture | done | `068532d` |
| M3 Runtime, renderer, preview, stills | done | `5d43820` |
| M4 QA | done | see `git log` (`feat(m4)`) |
| M5 Audio | not started | |
| M6 Agent layer | not started | |
| M7 Changelog & CI | not started | |
| M8 Dogfood | not started | |
| M9 Docs & release readiness | not started | |

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
- [ ] Music synth + `beats.json`; SFX generation script + bundled set
- [ ] Voice providers (mocked HTTP tests), cache, cost estimate
- [ ] Captions (VTT/SRT + runtime), mix + ducking + loudnorm, provenance + DM-A04
- [ ] `clean-launch` renders with music + SFX; loudness within target ± 1 LU (measured: ___ LUFS)

## M6 — Agent layer
- [ ] SKILL.md + references + 5 style docs; one reference composition per style, all passing QA
- [ ] `skill install`; plugin + marketplace manifests; `npx skills add` compatible
- [ ] MCP server with all tools; smoke test passes
- [ ] `make` adapters (claude, codex, cursor, custom), interactive + headless; `--dry-run` verified against the real CLIs' `--help`

## M7 — Changelog & CI
- [ ] `changes` with import-graph route mapping; `capture --changed`
- [ ] GitHub Action + `ci init`
- [ ] Harborly test branch: correct affected routes; action scripts run locally end-to-end with the mocked agent

## M8 — Dogfood
- [ ] Launch video (30–40 s, 16:9 + 9:16, `clean`), QA 0 errors
  - Rubric (clarity / truth / pacing / hierarchy / brand / motion / polish / ending): _ / _ / _ / _ / _ / _ / _ / _
  - Contact sheets:
- [ ] Changelog clip (12–18 s), QA 0 errors
- [ ] Baseline one-prompt video + `docs/media/grounded-vs-generic.mp4` + `.gif` (≤ 8 MB)
- [ ] Friction log below: every item fixed or explicitly deferred

### Friction log
-

## M9 — Docs & release readiness
- [ ] All docs (SPEC §19); README with the GIF; generated config + QA-rule docs
- [ ] changesets configured; `release.yml` prepared (not run); version 0.1.0
- [ ] Tarball smoke test via npx (and bunx if available)
- [ ] `pnpm verify` + `pnpm verify:dogfood` pass; `git status` clean
