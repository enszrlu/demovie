# Capture and auth

## The app lifecycle

`npx demovie up` (and every `capture`) seeds demo data, starts the app and waits until it answers:

```jsonc
"app": {
  "url": "http://localhost:3000",
  "start": { "command": "pnpm dev", "cwd": ".", "env": { "DEMO_MODE": "1" }, "readyPath": "/", "timeoutMs": 120000 },
  "reuseRunning": true,                 // use the app if it already answers at app.url
  "headers": {}                         // e.g. { "x-vercel-protection-bypass": "$env:VERCEL_AUTOMATION_BYPASS_SECRET" }
},
"demo": { "seed": "pnpm demo:seed" }
```

`npx demovie down` stops what `up` started. App output goes to `.demovie/.cache/app.log`.

## Logging in

| `auth.strategy` | When | How |
|---|---|---|
| `none` | Public apps | — |
| `form` | Email + password login | Fills `auth.loginPath` with the env vars named by `usernameEnv`/`passwordEnv` (default `DEMOVIE_USER`/`DEMOVIE_PASSWORD`), waits for `successPath`. |
| `storageState` | OAuth, magic links, 2FA | `npx demovie auth record` opens a real browser; you log in by hand; the session is saved to `.demovie/.auth/state.json` (gitignored). |
| `script` | Anything else | `.demovie/auth.ts` default-exports `async ({ page, baseURL, env }) => { … }`. |

`npx demovie auth test` checks the login. Credentials live in your environment or `.demovie/.env` (gitignored), never
in `config.json` — use `"$env:NAME"` references there. Use a demo account, not a real one.

## Capturing

```bash
npx demovie capture                                  # every route and flow at the default viewports
npx demovie capture --route "/app/projects" --route "/app/**"
npx demovie capture --flow create-project
npx demovie capture --viewport mobile --dark --full-page
npx demovie capture --changed --since v1.2.0         # only stale states and routes affected by changes since a ref
```

Each state is captured after: the clock is frozen at `demo.now` (timezone and locale from `demo`), analytics and
third-party requests are blocked (`demo.blockRequests`), selectors in `demo.hide` are hidden, network is idle, fonts
and images are loaded, and animations have finished. Per-route waits go in `capture.waitFor`
(`{ "/app": "main" }`), dynamic routes get their params from `capture.routes.params`.

## Redaction

Before the screenshot, text matching `demo.mask.patterns` (emails, phone numbers, secrets) is replaced in the page with
fictional values of similar length (or `•••` with `demo.mask.replacement: "dots"`), except values matching `demo.mask.allow` (e.g. `*@harborly.demo`). `demo.mask.selectors`
masks whole elements. Redactions are listed in each capture's `meta.json`.

## Flows

See [flows in the skill reference](../packages/skill/demovie/references/flows.md) — YAML or TypeScript journeys that
capture named states, e.g. `flows/create-project@desktop/dialog`.

## Freshness

`captures/index.json` records the git HEAD, the config hash and a hash of each route's source file plus its layout
chain. `status` reports stale captures; `capture --changed` refreshes only those (and, with `--since`, the routes your
commits affect through the import graph).
