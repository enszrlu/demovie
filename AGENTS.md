# AGENTS.md: working agreement for coding agents

You are building **demovie**, an open-source (MIT) toolkit that gives AI coding agents what they need to make **accurate, on-brand motion-graphics videos of a real web app**. `SPEC.md` is the source of truth; read it fully before you change anything.

## Files you maintain
- `PROGRESS.md`: tick acceptance boxes as they genuinely pass. Also record timings, the friction log and rubric scores.
- `DECISIONS.md`: every choice SPEC.md doesn't settle, with a one-line rationale. Append; don't rewrite history.
- Keep `SPEC.md` unchanged. If it is wrong or impossible somewhere, record the deviation in DECISIONS.md and implement the closest faithful alternative.

## Commands (once M0 exists)
```bash
pnpm install
pnpm build                       # build all packages
pnpm test                        # unit tests
pnpm test:integration            # real Chromium + examples/harborly
pnpm verify                      # everything; must end with "VERIFY OK (<n> checks)"
pnpm verify:dogfood              # M8 outputs exist and pass QA
pnpm --filter harborly dev       # run the fixture app (http://localhost:3000)
pnpm --filter harborly demo:seed # seed fictional demo data
node packages/cli/dist/index.js --help   # run the built CLI
```

## How to work
- Follow the milestones in SPEC §20 strictly in order. After each one: run `pnpm verify`, update PROGRESS.md, then `git commit -m "feat(mN): …"` locally.
- Keep changes small and tested. Every CLI command needs `--json` output, a clear error with a `fix:` hint, and tests.
- Define every file format as a zod schema in `packages/core/src/schemas`. Generate the JSON Schemas; never hand-write them.
- Prefer boring, well-maintained dependencies under the licenses allowed in SPEC §5.4. Run the license check before adding a new one.
- **Verify, don't assume**, for anything outside this repo that changes often. Record what you found in DECISIONS.md. This includes:
  - the flags of `claude`, `codex` and Cursor's CLI (check `--help`);
  - Claude Code plugin and marketplace manifest formats;
  - Agent Skills install paths;
  - the current Next.js version and its `proxy.ts`/`middleware.ts` behavior;
  - the ElevenLabs and OpenAI TTS endpoints.
- Performance budgets are in SPEC §11.8. Measure against them and record the results.
- Look at what you produce. For anything visual (captures, stills, contact sheets, renders), open the PNGs and review them; don't rely only on exit codes.

## Hard constraints
- Never publish to npm, push to a git remote, create accounts, or use real credentials. The Harborly seed user is a fixture.
- Never add Remotion or any GPL/AGPL/LGPL package. Don't bundle ffmpeg.
- Never implement AI-vendor login, OAuth, or subscription-token handling. `make` only launches binaries the user installed and signed into themselves; in CI it passes through API keys.
- Never download audio or media from the internet for videos. Audio is synthesized, provider-generated with the user's key, or imported with `--licensed`.
- Never modify files outside this repository.
- Tests that need paid API keys must skip cleanly when keys are absent.

## Code style
- TypeScript strict, ESM only, Node ≥ 20.19. Biome handles formatting and lint.
- Library packages never call `console.log`; use the shared logger, which writes to stderr so `--json` stays clean on stdout.
- Keep names explicit. Keep comments short and only where the code can't say it itself.
