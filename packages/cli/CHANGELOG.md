# demovie

## 0.1.0

### Minor Changes

- Initial release.
  - **Ground:** `init` detects Next.js or a generic app and extracts brand, glossary and routes. `capture` takes screenshots and element maps of routes and multi-step flows, with seeded demo data, a frozen clock, login strategies, redaction and freshness tracking.
  - **Make:** a GSAP motion runtime with five style presets. Stills and contact sheets, a preview player, and a deterministic renderer to H.264 MP4s in 16:9, 9:16, 1:1 and 4:5.
  - **Check:** a QA engine with 30 rules, waivers and `--strict`.
  - **Audio:** a deterministic music synthesizer with `beats.json`, 12 CC0 SFX, ElevenLabs/OpenAI voiceover with your key, captions, ducking and loudness normalization.
  - **Agent layer:** an Agent Skill that plans the angle and the hook before any shot, a Claude Code plugin and marketplace, an MCP server with 15 tools, and `make` adapters for Claude Code, Codex, Cursor and custom agents. Headless `make` runs show one line per step and end with the time, the agent's reported cost and the videos written; `make` sets up a new project with `init` first.
  - **Help:** examples under every command's `--help`, and `clean` to free the render cache (`status` warns when it grows).
  - **Changelog mode:** `changes` with import-graph route mapping, `capture --changed`, a GitHub Action and `ci init`.
  - **Safety:**
    - compositions render in a network sandbox;
    - secrets are masked in every output, and headers and saved logins stay scoped to the app;
    - redaction covers shadow DOM, iframes, links and titles;
    - `make` keeps the agent away from config, credentials and nested runs;
    - paid calls need an explicit `--yes`.
  - **Types:** `demovie/flow` exports `defineFlow` with types, for TypeScript flows.
