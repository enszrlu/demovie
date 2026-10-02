# Recipes

Quick answers to common "how do I…" questions. Each links to the full reference. If you work with an agent, you can
also just ask it ("make a vertical version"); these are the commands it uses.

## Formats and length

**A vertical (9:16) or square version.** Capture the pages on a phone first, then ask for the format:

```bash
npx demovie capture --route "/app/projects" --viewport mobile
npx demovie make --type teaser --format 9:16,1:1 --about "the Projects board"
```

demovie designs each format separately (it doesn't crop a 16:9 video). Formats: `16:9`, `9:16`, `1:1`, `4:5`.

**A shorter or longer video.** Pick a type, or set the length: `--type teaser` (8–15 s), `--type feature` (20–35 s),
`--duration 45`.

**A GIF or a WebM too.**

```bash
npx demovie render launch --gif --webm
```

**A silent loop for a landing page.** `npx demovie make --type hero-loop`: 6–15 s, muted, and the last frame matches
the first.

## Look and sound

**A different style.** `--style` on `new`, or ask your agent: `clean`, `bold`, `soft`, `editorial`, `terminal`. See
[styles](styles.md).

**Your own music.** Import a track you hold a license for, point the video at it and measure its beats:

```bash
npx demovie add track.mp3 --licensed --describe "Artlist license #1234"
npx demovie audio music launch --provider file
```

Set `audio.music.src` to `"assets/track.mp3"` in the video's `video.json` before the second command. See
[audio](audio.md).

**A voiceover.** Put `ELEVENLABS_API_KEY` or `OPENAI_API_KEY` in `.demovie/.env`, then:

```bash
npx demovie audio voice launch            # prints the cost estimate
npx demovie audio voice launch --yes      # after you accept it
```

Captions are generated from the voiceover and burned into the 9:16 version.

**Brand colors or fonts look wrong.** Run your app (`npx demovie up`), then `npx demovie extract brand` to read them
from the running app, or edit `.demovie/brand/brand.json` by hand.

## Screens and data

**Hide a cookie banner or a chat widget.** Add its CSS selector to `demo.hide` in `.demovie/config.json`, then
recapture.

**Mask more personal data.** Add patterns (regular expressions) or CSS selectors under `demo.mask` in the config.
Emails, phone numbers and things that look like secrets are masked by default.

**Show a fixed date.** Set `demo.now` (and `demo.timezone`) in the config. Every capture freezes the clock there, so
"due tomorrow" stays true.

**Dark mode.** `npx demovie capture --dark` captures both themes.

**A state behind clicks** (a dialog, a filled form). Write a [flow](guides/capture-flows.md).

**After a UI change.** `npx demovie capture --changed` refreshes only the stale captures.

**A page that scrolls.** `npx demovie capture --full-page` also saves the whole page, so a shot can scroll through it.

## Your app

**Not Next.js.** Start your app, then `npx demovie init --url http://localhost:5173`.

**A monorepo.** `npx demovie init --app apps/web`, or run `init` inside the app's folder.

**A preview deployment instead of a local app.** Set `DEMOVIE_APP_URL=https://my-preview.example.com` for a command,
and demovie uses it instead of starting the app.

**A login with Google, a magic link or 2FA.** `npx demovie auth record` and log in by hand once. See
[apps with a login](guides/apps-with-login.md).

## Agents

**Codex or Cursor instead of Claude Code.** `npx demovie make --agent codex`, or `npx demovie skill install --agent
cursor` and ask in Cursor. See [agents](agents.md).

**See what `make` would run.** `npx demovie make --dry-run` prints the exact agent command.

**Run without stopping for review.** `npx demovie make --no-review`, or `--yes` to also skip every other prompt.

## Speed and disk

**Faster renders while iterating.** `--quality draft`, one `--format`, or a lower `--scale`. `--workers` sets how many
browser pages render in parallel.

**Free disk space.** Rendered frames are kept for faster re-renders. `npx demovie clean` deletes them.

**Something's wrong.** `npx demovie doctor` checks your setup, and every error ends with a `fix:` line. See
[troubleshooting](troubleshooting.md).
