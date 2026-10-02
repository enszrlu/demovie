# Agents

demovie is skill-first: your agent reads the demovie Agent Skill and drives the CLI. It works with any agent that can
run shell commands; Claude Code, Codex and Cursor are set up by `init`.

| Agent | Skill | MCP | `make` |
|---|---|---|---|
| Claude Code | `.claude/skills/demovie/` (or the plugin) | `claude mcp add demovie -- npx -y demovie mcp`, or the plugin's `.mcp.json` | `claude` (interactive) · `claude -p … --output-format stream-json` |
| Codex CLI | `.agents/skills/demovie/` | `codex mcp add demovie -- npx -y demovie mcp` (global config; demovie only prints it) | `codex` · `codex exec --json` |
| Cursor | `.agents/skills/demovie/` (Cursor also reads `.claude/skills`) | `.cursor/mcp.json` (written by `init`, merged) | `cursor-agent` · `cursor-agent -p --output-format stream-json` |
| Others | Any agent that reads Agent Skills | Any MCP client: `npx -y demovie mcp` | `make --agent custom --agent-cmd "mytool run {prompt}"` |

## The skill

`npx demovie skill install` copies the skill into the project for your agents (`--agent claude,codex,cursor`); add
`--global` only if you want it in your user folders. The skill is versioned; `status` tells you when it is older than
the CLI. It contains the workflow (preflight → brief → capture plan → storyboard → style frames → animate → QA loop →
render → report), hard rules (never mock UI, never invent facts), the "AI look" to avoid, a rubric, and references:
the runtime API, motion and pacing guides, templates, flows, audio, QA rules and the style guides.

Other ways to install it:

- **Claude Code plugin:** `/plugin marketplace add enszrlu/demovie`, then `/plugin install demovie@demovie`. The
  plugin bundles the skill and registers the MCP server.
- **skills.sh:** `npx skills add enszrlu/demovie`.

## MCP server

`npx demovie mcp` serves these tools on stdio: `status`, `init_check`, `extract`, `list_routes`, `list_captures`,
`capture`, `get_elements`, `new_video`, `stills` (returns the contact sheet as an image), `qa`, `audio_music`,
`audio_voice` (needs `confirm: true` after you approve the cost), `audio_mix`, `render`, `changes`. Long operations
send progress notifications.

## `demovie make`

```bash
npx demovie make --type launch --about "the Projects board"                 # interactive: review brief and storyboard
npx demovie make --type changelog --yes                                    # headless: works autonomously
npx demovie make --agent codex --format 16:9,9:16 --dry-run                 # print the exact command
npx demovie make --agent custom --agent-cmd "mytool run {prompt}"
```

In a folder without `.demovie/`, it runs `init` first (asking its questions in a terminal, using defaults with
`--yes`). It finds the agent CLIs on your PATH (or uses `--agent`), installs the project skill if missing, and starts
the agent with this prompt: *"Use the demovie skill to make a {type} video ({duration}s, {formats}) about: {about}. Resources:
{files}. Voiceover: {on|off}. Review the brief and storyboard with me before animating."* (or *"Work autonomously; do
not ask questions."* with `--yes`, `--no-review` or in CI). In a terminal with review on, the agent runs
interactively; otherwise it runs in its print/exec mode and demovie exits with its exit code.

When the agent runs headless (no terminal, `--yes` or CI), demovie turns its event stream into one line per step, keeps the raw stream in
`.demovie/.cache/make/<time>.jsonl`, and ends with a summary:

```
[ 2m 15s] → Bash npx demovie stills projects-board-teaser --every 1 --format all --sheet
[ 2m 35s] → Bash npx demovie qa projects-board-teaser --format all
[ 3m 11s] Rendered. Writing the share copy.
Claude Code finished · 3m 21s · 43 turns · $1.06 (as reported by Claude Code)
videos: .demovie/videos/projects-board-teaser/out/projects-board-teaser-16x9.mp4
full agent log: .demovie/.cache/make/2026-10-02T22-47-10-813Z.jsonl
```

The cost is the agent's own estimate; on a subscription it's usage, not a bill.

demovie only launches binaries you installed and signed in to yourself, and passes through API keys you set in CI. It
never logs in, reads tokens or embeds an agent SDK. See [licensing and terms](licensing-and-terms.md).
