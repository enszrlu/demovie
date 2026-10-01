# Progress

This checklist mirrors SPEC §20; if they conflict, SPEC wins. Tick a box only once the thing is verified, and add a short note with evidence: a command, a number, or a path.

| Milestone | Status | Commit |
|---|---|---|
| M0 Scaffold | done | see `git log` (`feat(m0)`) |
| M1 Core & init | not started | |
| M2 Capture | not started | |
| M3 Runtime, renderer, preview, stills | not started | |
| M4 QA | not started | |
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
- [ ] zod schemas for all `.demovie/` files + generated JSON Schemas
- [ ] Detection, route discovery, brand, glossary, metadata extractors
- [ ] `init` (interactive + `--yes`), `doctor [--fix]`, `status`, `extract`, `glossary sync`
- [ ] Harborly: valid config/brand/glossary/routes; correct primary color, Geist fonts, logo; ≥ 10 routes with correct `protected` flags
- [ ] pages-minimal and static-site fixtures detected correctly

## M2 — Capture
- [ ] `up`/`down`, seed, frozen clock, hide/block requests
- [ ] Auth: none, form, storageState (`auth record`), script; `auth test`
- [ ] Route capture, flows (YAML + TS), element maps, redaction, freshness, `--changed`
- [ ] Harborly: all static routes + `[id]` + `create-project` flow (desktop) + 2 mobile routes
- [ ] Element ids stable across two runs; settings email/API key redacted
- [ ] Capture within budget (time: ___ s)

## M3 — Runtime, renderer, preview, stills
- [ ] `clock.js` + runtime API (screen, cursor, typeText, text, callout, captions, transition, logo) + style CSS
- [ ] Renderer, stills + contact sheet, preview server with hot reload, `new` scaffolding
- [ ] `examples/compositions/clean-launch` renders 16:9 + 9:16 final MP4s; ffprobe assertions pass
- [ ] Determinism tests pass
- [ ] Budgets: stills ___ s · draft ___ s · final ___ s (or deviations recorded in DECISIONS.md)

## M4 — QA
- [ ] Every rule in SPEC §12 with passing + failing synthetic tests
- [ ] `qa.json`, fix hints, waivers, `--strict`, preview QA overlay
- [ ] `clean-launch` passes with 0 errors; each `bad-*` fixture triggers its intended rules

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
