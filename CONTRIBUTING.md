# Contributing to demovie

Thanks for helping! demovie is MIT-licensed; by contributing you agree your work is released under the same license.

## Setup

```bash
pnpm install                     # Node ≥ 20.19, pnpm 9, ffmpeg with libx264 on PATH
pnpm build                       # builds every package (CLI bundle, runtime, skill, plugin)
pnpm --filter harborly dev       # the fixture app on http://localhost:3000 (demo data: pnpm --filter harborly demo:seed)
node packages/cli/dist/index.js --help
```

Chromium for Playwright: `node packages/cli/dist/index.js doctor --fix`.

## Checks

```bash
pnpm test                # unit tests
pnpm test:integration    # real Chromium + examples/harborly
pnpm verify              # everything; must end with "VERIFY OK (<n> checks)"
```

`pnpm verify` runs Biome, the typecheck, the build, unit tests, the license check, integration tests, QA on every
reference composition, a render smoke test, the MCP smoke test, skill lint, the plugin/marketplace manifests, the
GitHub Action dry-run, the docs check and a tarball smoke test. Please run it before opening a pull request.

Conventions: TypeScript strict, ESM, Biome formatting. Library packages never write to stdout (use the shared logger,
which writes to stderr). Every file format is a zod schema in `packages/core/src/schemas`. Every CLI command has
`--json` output, errors with a `fix:` hint, and tests. Allowed dependency licenses: MIT, Apache-2.0, BSD, ISC, 0BSD,
MPL-2.0, CC0, OFL (fonts) — no GPL/AGPL/LGPL, no Remotion. Fixtures use fictional data only; a fictional secret in a
real provider's format (a Stripe-style key, say) gets one character unicode-escaped, or GitHub push protection rejects
the push.

## Regenerating the examples

Captures, WAVs and renders are gitignored. With Harborly running (`pnpm --filter harborly dev`):

```bash
cd examples/harborly
export DEMOVIE_USER=demo@harborly.demo DEMOVIE_PASSWORD=harborly-demo   # the fixture's demo login
node ../../packages/cli/dist/index.js capture
for slug in launch changelog; do
  node ../../packages/cli/dist/index.js audio music $slug
  node ../../packages/cli/dist/index.js audio mix $slug
  node ../../packages/cli/dist/index.js render $slug --format all
done
cd ../.. && pnpm verify:dogfood
```

The reference compositions render the same way with `../compositions/<name>` as the slug (`pnpm verify` regenerates
their audio itself), and `pnpm comparison:build` rebuilds `docs/media/grounded-vs-generic.*` after rendering
`../baseline-one-prompt` and `launch` in 16:9.

## Adding a QA rule

1. Add the rule to `packages/qa/src/rules.ts` (`id`, `severity`, `title`, `measurement`, `fix`, `check(input)`); use
   `persistent()` for violations that must last a while, and fill `bbox` so the preview overlay can show it.
2. Add a failing and a passing synthetic case in `packages/qa/test/rules.test.ts`.
3. If it needs new facts from the page, extend `inspect()` in `packages/runtime/src/inspect.ts` and `collect()` in
   `packages/qa/src/collect.ts`.
4. Run `pnpm skill:build` (regenerates the rule table in the skill) and `pnpm docs:build`.

## Adding a style

1. `packages/runtime/styles/<name>.css` with the tokens and classes the other presets define.
2. `packages/skill/demovie/references/styles/<name>.md` (motion tokens, type scale, do and don't).
3. A reference composition `examples/compositions/<name>-launch/` using Harborly captures that passes QA with 0 errors,
   and an annotated excerpt in `packages/skill/demovie/references/examples/`.
4. Add the name to `STYLE_IDS` in `packages/core/src/schemas/common.ts` and a default mood in
   `packages/audio/src/music.ts`.

## Adding an agent adapter

1. `packages/cli/src/adapters/<agent>.ts`: binaries, interactive and headless arguments, the model flag, and the flags
   to verify against `--help`.
2. Register it in `packages/cli/src/adapters/index.ts` and `AGENT_IDS`.
3. Unit-test the argument construction in `packages/cli/test/make.test.ts`; record the verified CLI version in
   `DECISIONS.md`.

## Releases

Changesets (`pnpm changeset`) describe user-facing changes; maintainers run the release workflow, which publishes with
npm trusted publishing (no token). Never publish from a local machine. The one exception is a package's very first
version: npm only lets you add a trusted publisher once the package exists.
