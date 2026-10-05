# Troubleshooting

Every error prints what failed, why, and a `fix:` line with the exact command or edit. With `--json` the error is
`{ "ok": false, "error": { "code", "message", "fix" } }`. `npx demovie doctor` checks Node, ffmpeg (with libx264),
ffprobe, Chromium (it launches it once), the config, the app, auth and git; `doctor --fix` installs Chromium and
creates missing folders.

| Symptom | Fix |
|---|---|
| `no .demovie/config.json found` | Run `npx demovie init` in the app's root folder. |
| `E_APP_UNREACHABLE` | `npx demovie up`; check `app.url` and `app.start.command`; read `.demovie/.cache/app.log`. |
| Captures show a different app | Another app is running on your app's port, and demovie reuses whatever answers at `app.url`. Stop it, or set `app.reuseRunning` to `false` so demovie stops with an error instead of capturing it. |
| `something already answers at … so demovie can't start …` | Another server holds your app's port (often a dev server that is still running): stop it (`npx demovie down` stops what `up` started; `lsof -i :3000` finds the rest) or change `app.url`. If it is your app and that page returns an error, set `app.start.readyPath` to one that answers. |
| `E_AUTH` | `npx demovie auth test`; set the env vars named in `auth.usernameEnv` / `auth.passwordEnv`; for OAuth or 2FA use `npx demovie auth record`. |
| ffmpeg or Chromium missing (exit code 3) | Install ffmpeg; `npx demovie doctor --fix` for Chromium. |
| Chromium is installed but won't launch on Linux (missing libraries) | `sudo npx -y playwright-core@<version> install-deps chromium`, with the version `doctor` prints. |
| The app never answers when demovie starts it (a Next.js dev server stuck compiling) | Start it with webpack instead of Turbopack (set `app.start.command` to `next dev --webpack -p 3100`), or use a production build (`next build && next start`). |
| A capture shows a spinner or a cookie banner | Add `capture.waitFor` for the route; add the banner's selector to `demo.hide`. |
| Personal data visible in a capture | Add patterns or selectors to `demo.mask`; re-capture. |
| `unknown element id` | Use an id from that capture's `elements.json` (the error lists the nearest); re-capture after UI changes. |
| `the composition did not call v.ready()` | An exception in `main.js` before `v.ready()` (the error lists the console messages); open `npx demovie preview <slug>` and read the console. |
| QA `DM-R01` (frames differ between renders) | Remove `Date`, `Math.random`, timers and tweens outside `v.timeline`; use `v.random(seed)`; drop `will-change` from animated elements (Chromium caches their raster between frames). |
| QA `DM-G02` / `DM-G04` (invented words or numbers) | Use the glossary's terms and numbers from captures or the brief; or add the real term to `glossary.md` and run `npx demovie glossary sync`. |
| QA `DM-G05` (blurry captures) | Zoom less, or capture at a higher `deviceScaleFactor`. |
| QA `DM-S01` (loudness) | Run `npx demovie audio mix <slug>` after every audio change. |
| Render is slow | Use `--quality draft` while iterating; `--workers n` to change parallelism; unchanged frames are reused. |
| Disk filling up | Rendered frames are kept for faster re-renders: `npx demovie clean` frees them (`status` warns past 2 GB). |
| What did the agent do in `make`? | Headless runs print one line per step; the full stream is in `.demovie/.cache/make/<time>.jsonl`. |
| `status` warns that the skill is old | `npx demovie skill install`. |

Exit codes: `0` success · `1` failed or QA errors · `2` usage or config error · `3` missing prerequisite · `4` app
unreachable or auth failed.
