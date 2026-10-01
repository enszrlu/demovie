# Decisions

Append-only log of choices SPEC.md doesn't settle, and of any deviation from it. Format: `D<n> — <date> — <decision>. Why: <reason>.`

## Pre-decided (from SPEC §22)
- **D1:** Compositions are HTML + GSAP, rendered by our own renderer. No Remotion; no dependency on HyperFrames.
  - Why: Remotion's license would charge our users' 4+ person teams and restricts rendering services. HyperFrames is owned by a competitor and still pre-1.0. Agents write plain HTML best.
- **D2:** pnpm + Node is the reference runtime; bunx is supported.
  - Why: Playwright and `npx` are the most common path.
- **D3:** Config lives in `.demovie/config.json` (JSON + JSON Schema).
  - Why: it works without installing the package, and agents can edit it safely.
- **D4:** Use the system ffmpeg; don't bundle it.
  - Why: bundled builds carry GPL codecs and are large.
- **D5:** Agent integration is skill-first. `make` is only a convenience launcher.
  - Why: skills work across agents, and vendor CLIs and terms change quickly.
- **D6:** No telemetry.
  - Why: trust.
- **D7:** MIT license.
  - Why: adoption.
- **D8:** v1 captures are screenshots + element maps.
  - Why: simple and reliable; DOM snapshots come later.

## Build-time decisions
<!-- The builder appends here, e.g.:
D9 — 2026-10-01 — Frame format for final renders: PNG. Why: JPEG q92 saved 18% time but produced visible banding on gradients (benchmark in PROGRESS.md).
-->
- **D9** — 2026-10-01 — Pin `playwright-core` to 1.60.0. Why: its Chromium build (r1223, Chrome 148) is already in the local Playwright cache, so building and testing never downloads browsers outside the repo; 1.61–1.63 need r1228–r1243. Users install the matching Chromium with `demovie doctor --fix`.
- **D10** — 2026-10-01 — TypeScript 5.9.3, not 6.x/7.x. Why: SPEC §5.2 says TypeScript 5.x; 5.9 is the last 5.x.
- **D11** — 2026-10-01 — vitest 4.1 (not 5.0). Why: 5.0 is days old; 4.1 is mature and supports Node 20.
- **D12** — 2026-10-01 — commander 14 and execa 9 (not commander 15 / execa 10). Why: the latest majors require Node ≥ 22; demovie supports Node ≥ 20.19 (SPEC §5.2).
- **D13** — 2026-10-01 — Exclude `sharp` via `pnpm.ignoredOptionalDependencies`. Why: Next.js pulls it optionally and its libvips binary is LGPL-3.0; the Harborly fixture doesn't use `next/image` optimization, and no GPL-family code may appear anywhere in the tree.
- **D14** — 2026-10-01 — Verified Next.js 16.3.8 (docs shipped in `node_modules/next/dist/docs`): `proxy.ts` at the project root or `src/`, exporting `proxy` (or default) plus `config.matcher`; it runs on the Node.js runtime by default and rejects a `runtime` option; `middleware.ts` is deprecated but still read. demovie parses both files.
- **D15** — 2026-10-01 — Internal packages export TypeScript source (`exports: ./src/index.ts`); only `demovie` (tsdown) and `@demovie/runtime` (esbuild) are built. tsdown's `deps.onlyBundle: [/^@demovie\//]` fails the build if any third-party package would be bundled; every third-party dependency stays a declared npm dependency of `demovie`. Why: one build step, accurate license accounting, fast tests.
- **D16** — 2026-10-01 — While milestones are pending, `pnpm verify` ends with `VERIFY OK (<passed> checks, <k> pending)`; with nothing pending it prints exactly `VERIFY OK (<n> checks)`. A check is pending only while the files it verifies don't exist yet. Why: SPEC §18 allows `pending` during the build but not at the end, and the final line must stay unambiguous.
- **D17** — 2026-10-01 — Tests, verify and smoke tests write temporary files only under `<repo>/.tmp/` (gitignored), never the OS temp dir. Why: AGENTS.md forbids modifying files outside the repository.
- **D18** — 2026-10-01 — Harborly loads Geist through the `geist` npm package (which wraps `next/font/local`), not `next/font/google`. Why: no network at build/dev time ("no external services"); demovie's extractor maps `geist/font/sans|mono` to "Geist"/"Geist Mono" and copies the OFL woff2 files.
- **D19** — 2026-10-01 — Harborly's settings page shows `maya.chen@acme-rockets.example` and `sk_live_…` as the values redaction must catch. Why: the config allow-lists `*@harborly.demo` (the fictional demo domain, as in SPEC §6.1), so the redaction target must be an email outside that domain.
- **D20** — 2026-10-01 — Harborly's `next.config.ts` sets `agentRules: false`. Why: Next 16.3 `next dev` writes AGENTS.md/CLAUDE.md into the app folder when it detects an AI agent (verified in `next/dist/server/lib/generate-agent-files.js`); a fixture must not grow files when tests run it.
- **D21** — 2026-10-01 — Harborly's app URL is `http://localhost:3000`, never `127.0.0.1`. Why: Next 16 `next dev` blocks `/_next/hmr` for the 127.0.0.1 origin, so pages browsed there never hydrate (no charts, no client state). demovie's detection already defaults to `localhost`.
- **D22** — 2026-10-01 — Harborly computes server-side "now" (KPIs, overdue states, timestamps of projects created by flows) from `db.meta.referenceNow` (2026-09-15T10:30Z in seeded data); relative times ("2h ago") are computed client-side, so `demo.now` controls them. Why: captures must not drift with the real clock.
- **D23** — 2026-10-01 — Harborly's primary `oklch(0.546 0.245 262.881)` normalizes to `#155dfc` (Tailwind v4 blue-600), not `#2563eb` (Tailwind v3 blue-600, a different oklch value). Why: verified by the converter's unit tests against Tailwind v4's published hex values.
- **D24** — 2026-10-01 — Static analysis of JS/TS (next.config, tailwind.config, layout metadata, proxy matcher, seed files, import graphs) uses esbuild to strip types/JSX (with `verbatimModuleSyntax` so value imports survive) plus `acorn` (MIT) for the AST. Nothing from the user's project is ever executed.
- **D25** — 2026-10-01 — `init --url <url>` selects generic mode even inside a Next.js project, as SPEC §8.1 says ("generic mode when --url is given"); `--framework nextjs` overrides it.
- **D26** — 2026-10-01 — `glossary.md` format: an H1, a key list (`**Product name:**`, `**Tagline:**`, `**CTA URL:**`), then `## Features` (`- Term — source`), `## UI labels`, `## Entities`, `## People`, `## Avoid`, `## Discovered`. Discovered items count as `uiLabels` in glossary.json (they are real captured UI text); capture and extract only ever append to Discovered.
- **D27** — 2026-10-01 — Pages Router discovery also skips `404`/`500` error pages, besides `_app`, `_document`, `_error` and `api/**`. Why: they aren't product screens.
- **D28** — 2026-10-01 — Route protection: when `proxy.ts`/`middleware.ts` references auth (login/session/redirect), a route is protected iff its matcher matches; otherwise folder names are hints (`(dashboard)`, `(app)`, `(auth)`, `app/`, `dashboard/` …). Login/sign-up pages are never protected. When the app is reachable, an unauthenticated probe confirms: a redirect to login (or 401/403) means protected.
- **D29** — 2026-10-01 — Runtime primary color: if any filled button (contrast ≥ 1.5 against the page background) matches the static `--primary`, the token is "runtime-confirmed"; otherwise the largest filled button's color wins, and the static value is kept in provenance. Why: SPEC §8.3 says runtime wins for rendered colors, and dark CTA buttons on many sites would otherwise override a real primary.
- **D30** — 2026-10-01 — Code that runs inside pages (`page.evaluate`) is written as plain JS strings. Why: tsx/esbuild `keepNames` helpers (`__name`) leak into serialized functions and crash in the browser.
- **D31** — 2026-10-01 — Brand font files are stored as `brand/fonts/<family-slug>-<weight|variable>.<ext>` (e.g. `geist-variable.woff2`). Why: `brand.json` lists files without per-file weights; the runtime derives `font-weight` (a range for variable fonts) from the name.
- **D32** — 2026-10-01 — Capture freshness: a state is stale when the config hash or a hashed source file (page + layout chain; flow file) changed, or its screen.png is missing. The git HEAD is recorded for provenance and `--changed --since`, but a moved HEAD alone doesn't make every capture stale. Why: otherwise every unrelated commit would invalidate all captures and `--changed` would be useless.
- **D33** — 2026-10-01 — The tarball smoke test (`pnpm verify` check 14) installs the packed `demovie` tarball with `npm install` into `.tmp/smoke/` (third-party dependencies come from the npm registry, using the user-level npm cache), then runs `npx --no-install demovie --version`, `doctor --json` and `init --yes` on a Harborly copy, and repeats `--version`/`doctor` with `bun add` + `bunx` when bun is installed. Why: closest local equivalent of `npx demovie` without publishing.
- **D34** — 2026-10-01 — Capture runs the demo seed at the start of every `capture`/`up` (also when reusing a running app), and flows run after all route states, one at a time. Why: flows change demo data (create-project adds `prj_q4-launch`), and re-seeding first keeps flow URLs, captured text and element ids identical across runs.
- **D35** — 2026-10-01 — `capture --route …` without `--flow` captures only those routes; flows run when named with `--flow`, or when the capture isn't narrowed. A flow runs at its declared `viewport` unless both `--flow` and `--viewport` are given. Why: `capture --viewport mobile --route / --route /app/projects` (SPEC §20 M2) must not replay a desktop-only flow at phone size.
- **D36** — 2026-10-01 — `capture.routes.params` in config.json wins over params found by crawling (routes.json). Why: SPEC §8.2 orders the sources config → crawl → `needsParams`.
- **D37** — 2026-10-01 — Before each flow capture the mouse is parked at (0,0) unless the previous step was `hover`, and Chromium is launched with `--lang=<demo.locale>`. Why: Playwright leaves the mouse over the last clicked element (unwanted hover styles), and date inputs follow the browser UI language, not the context locale.
- **D38** — 2026-10-01 — `auth record` (headed browser, manual login) is exercised manually only; automated tests cover `form`, `script`, and `storageState` from a saved state (SPEC §18 lists exactly these). Why: a headed login needs a person.
- **D39** — 2026-10-01 — Integration tests capture into copies of Harborly (`.tmp/it-*`) whose seed command reseeds the running original (`pnpm --dir examples/harborly demo:seed`). Why: the dev server serves `examples/harborly`, and tests must never rewrite its committed `.demovie/` files.
- **D40** — 2026-10-01 — Harborly's committed `.demovie/` is the output of `demovie init --yes` + `extract` + `capture` (glossary Discovered labels and route titles included), plus three hand edits a user would make: `demo.now` matching the seed's reference time, `capture.routes.params` (`prj_launch`) and `waitFor` selectors for chart pages, and an `## Avoid` list (tasks, tickets, sprints). A second capture leaves these files byte-identical. The copied Geist woff2 files ship with their OFL license text.
