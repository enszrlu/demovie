# Troubleshooting

Every demovie error prints `fix:` with the exact command or edit. Start there. Common cases:

| Symptom | Fix |
|---|---|
| `no .demovie/config.json found` | `npx demovie init` in the app root (the folder with package.json). |
| App unreachable / `E_APP_UNREACHABLE` | `npx demovie up`; check `app.url` and `app.start.command` in `.demovie/config.json`; logs in `.demovie/.cache/app.log`. |
| Login fails / `E_AUTH` | `npx demovie auth test`; check the env vars named in `auth.usernameEnv`/`passwordEnv` (`.demovie/.env`); for OAuth/2FA use `npx demovie auth record`. |
| Chromium missing | `npx demovie doctor --fix` (installs Chromium via Playwright). |
| ffmpeg missing | Install ffmpeg (macOS `brew install ffmpeg`, Debian/Ubuntu `sudo apt-get install -y ffmpeg`), then `npx demovie doctor`. |
| A capture shows a spinner, a cookie banner or an empty state | Add a `waitFor` in `config.capture.waitFor` for that route, hide selectors in `demo.hide`, or seed data (`demo.seed`). |
| Personal data in a capture | Add patterns/selectors to `demo.mask`; re-capture. Redaction happens in the page before the screenshot. |
| `unknown element id "…"` from `rect()`/`focus()` | Use an id from that capture's `elements.json` (the error lists the nearest ones); re-capture if the UI changed. |
| `v.ready() was never called` / render times out | An exception before `v.ready()`; open `npx demovie preview <slug>` and read the console, or run `stills` and read the error. |
| Frames differ between renders (`DM-R01`) | Remove `Date`, `Math.random`, timers and free-running tweens; use `v.random(seed)` and `v.timeline`. |
| Text flagged too short (`DM-T01`) | Hold it longer or cut words: `max(1.2 s, 0.5 s + words / 3)`. |
| Invented vocabulary/numbers (`DM-G02`/`DM-G04`) | Use the glossary's terms and numbers visible in captures or the brief; or add the real term to `glossary.md` and run `npx demovie glossary sync`. |
| Blurry product UI (`DM-G05`) | Zoom less, or capture at `deviceScaleFactor: 2`/`3`; use a mobile capture for 9:16 close-ups. |
| Loudness warnings (`DM-S01`) | `npx demovie audio mix <slug>` after every audio change; lower SFX gains if peaks limit. |
| Stale captures in `status` | `npx demovie capture --changed` (or the listed routes) before reusing them. |
| `status` says the skill is older than the CLI | `npx demovie skill install`. |

Exit codes: `0` ok · `1` failed or QA errors · `2` usage/config · `3` missing prerequisite · `4` app unreachable or
auth failed. With `--json`, errors are `{ "ok": false, "error": { "code", "message", "fix" } }`.
