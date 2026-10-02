# demovie

**Your agent animates. demovie makes it true.**

Accurate, on-brand motion-graphics videos of your real web app — launch videos, feature clips, changelogs, teasers,
walkthroughs and hero loops — made by the AI coding agent you already use, from real captures of your running app,
and checked by a QA engine before they render.

## Quickstart

```bash
npx demovie init        # detect your app; extract brand, glossary and routes; set up demo data, login and the skill
npx demovie capture     # screenshots + element maps of every route and flow
npx demovie make        # start your agent with the demovie skill, or just ask it for a video
```

Requirements: Node ≥ 20.19 (or Bun), ffmpeg with libx264 on your PATH, and an app you can run locally. Next.js is
detected automatically; other apps work with `npx demovie init --url <url>`. `npx demovie doctor --fix` installs
Chromium for Playwright.

## What's in the package

- The `demovie` CLI. Every command supports `--json`, and every error ends with a `fix:` line.
- The demovie Agent Skill (`npx demovie skill install`) for Claude Code, Codex, Cursor and other skills-aware agents.
- An MCP server: `npx -y demovie mcp`.
- JSON Schemas for every file demovie writes (`schema/`).
- The composition runtime, fallback fonts and 12 CC0 sound effects.

demovie never logs in to AI services and never reads subscription tokens. `demovie make` starts the agent CLI you
installed and signed in to yourself; in CI, the GitHub Action passes through API keys you provide.

## License

MIT. The bundled fonts (Inter, Geist, Geist Mono) are under the SIL Open Font License. The bundled sound effects are
CC0 1.0.
