# Troubleshooting

Every error prints what failed, why, and a `fix:` line with the exact command or edit. With `--json` the error is
`{ "ok": false, "error": { "code", "message", "fix" } }`. `npx demovie doctor` checks Node, ffmpeg (with libx264),
ffprobe, Chromium, the config, the app, auth and git; `doctor --fix` installs Chromium and creates missing folders.

| Symptom | Fix |
|---|---|
| `no .demovie/config.json found` | Run `npx demovie init` in the app's root folder. |
| `E_APP_UNREACHABLE` | `npx demovie up`; check `app.url` and `app.start.command`; read `.demovie/.cache/app.log`. |
| `E_AUTH` | `npx demovie auth test`; set the env vars named in `auth.usernameEnv` / `auth.passwordEnv`; for OAuth or 2FA use `npx demovie auth record`. |
| ffmpeg or Chromium missing (exit code 3) | Install ffmpeg; `npx demovie doctor --fix` for Chromium. |
| A capture shows a spinner or a cookie banner | Add `capture.waitFor` for the route; add the banner's selector to `demo.hide`. |
| Personal data visible in a capture | Add patterns or selectors to `demo.mask`; re-capture. |
| `unknown element id` | Use an id from that capture's `elements.json` (the error lists the nearest); re-capture after UI changes. |
| `the composition did not call v.ready()` | An exception in `main.js` before `v.ready()` (the error lists the console messages); open `npx demovie preview <slug>` and read the console. |
| QA `DM-R01` (frames differ between renders) | Remove `Date`, `Math.random`, timers and tweens outside `v.timeline`; use `v.random(seed)`. |
| QA `DM-G02` / `DM-G04` (invented words or numbers) | Use the glossary's terms and numbers from captures or the brief; or add the real term to `glossary.md` and run `npx demovie glossary sync`. |
| QA `DM-G05` (blurry captures) | Zoom less, or capture at a higher `deviceScaleFactor`. |
| QA `DM-S01` (loudness) | Run `npx demovie audio mix <slug>` after every audio change. |
| Render is slow | Use `--quality draft` while iterating; `--workers n` to change parallelism; unchanged frames are reused. |
| `status` warns that the skill is old | `npx demovie skill install`. |

Exit codes: `0` success · `1` failed or QA errors · `2` usage or config error · `3` missing prerequisite · `4` app
unreachable or auth failed.
