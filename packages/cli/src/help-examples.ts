/**
 * Examples for every command, shown under `demovie <command> --help` and in the generated docs/cli.md.
 * Keys are command paths ("audio music"); each example is [what it does, the command].
 */
export const EXAMPLES: Record<string, [string, string][]> = {
  init: [
    ["Set up in a Next.js app (asks a few questions)", "npx demovie init"],
    ["Any other web app, already running on a port", "npx demovie init --url http://localhost:5173"],
    ["Non-interactive, for CI or scripts", "npx demovie init --yes --agents claude"],
  ],
  doctor: [
    ["Check prerequisites, config, app and login", "npx demovie doctor"],
    ["Install Chromium and create missing folders", "npx demovie doctor --fix"],
  ],
  status: [["What's captured, stale and rendered, and the next step", "npx demovie status"]],
  up: [["Seed demo data, start the app and wait until it answers", "npx demovie up"]],
  down: [["Stop the app that `up` started", "npx demovie down"]],
  clean: [
    ["See how much space the frame cache uses", "npx demovie clean --dry-run"],
    ["Delete rendered frames (the next render redraws them)", "npx demovie clean"],
    ["Also delete logs and other caches", "npx demovie clean --all"],
  ],
  "auth test": [["Log in with the configured strategy and report", "npx demovie auth test"]],
  "auth record": [["Log in by hand once (OAuth, magic link, 2FA) and save it", "npx demovie auth record"]],
  extract: [
    ["Re-extract everything after a redesign", "npx demovie extract"],
    ["Only the brand (colors, fonts, logo)", "npx demovie extract brand"],
  ],
  "glossary sync": [["Rebuild glossary.json after editing glossary.md", "npx demovie glossary sync"]],
  capture: [
    ["Every route and flow", "npx demovie capture"],
    ["One page on a phone, for a vertical video", 'npx demovie capture --route "/app/projects" --viewport mobile'],
    ["One flow, plus full-page screenshots", "npx demovie capture --flow create-project --full-page"],
    ["Only what your recent code changes touched", "npx demovie capture --changed --since v1.2.0"],
  ],
  "flow new": [
    ["Scaffold a YAML flow that starts on a page", "npx demovie flow new create-project --start /app/projects"],
    ["A TypeScript flow, for logic YAML can't express", "npx demovie flow new checkout --ts"],
  ],
  "flow run": [["Run one flow and capture its states", "npx demovie flow run create-project"]],
  changes: [
    ["Commits and affected routes since the last tag", "npx demovie changes"],
    ["Since a specific release, as JSON", "npx demovie changes --since v1.2.0 --json"],
  ],
  add: [
    ["Import a product photo with a description", 'npx demovie add hero.jpg --describe "our office"'],
    ["Import a music track you have a license for", "npx demovie add track.mp3 --licensed"],
  ],
  new: [
    ["A 35 s launch video in 16:9 and 9:16", 'npx demovie new launch --type launch --about "the Projects board"'],
    ["A 12 s vertical teaser in the bold style", "npx demovie new teaser --type teaser --format 9:16 --style bold"],
  ],
  preview: [["Scrub the video in the browser, with safe areas and QA", "npx demovie preview launch"]],
  stills: [
    ["Frames at given times, as a contact sheet", "npx demovie stills launch --at 2,9.5,16 --sheet"],
    ["One frame per second in every format", "npx demovie stills launch --every 1 --format all --sheet"],
  ],
  qa: [
    ["Run every QA rule on every format", "npx demovie qa launch"],
    ["Fail on warnings too", "npx demovie qa launch --strict"],
  ],
  "audio music": [
    ["Synthesize a license-clean bed and beats.json", "npx demovie audio music launch"],
    ["Pick the tempo and mood yourself", "npx demovie audio music launch --bpm 112 --mood energetic"],
  ],
  "audio sfx": [["List the bundled sound effects", "npx demovie audio sfx --list"]],
  "audio voice": [
    ["Estimate the cost of the voiceover first", "npx demovie audio voice launch"],
    ["Synthesize it once you accept the estimate", "npx demovie audio voice launch --yes"],
  ],
  "audio mix": [["Mix music, voice and SFX to −16 LUFS", "npx demovie audio mix launch"]],
  render: [
    ["Final MP4s in every format", "npx demovie render launch"],
    ["A quick draft while iterating", "npx demovie render launch --quality draft --format 16:9"],
    ["Also a GIF and a WebM", "npx demovie render launch --gif --webm"],
  ],
  make: [
    [
      "Ask your agent for a launch video (it asks you to review the plan)",
      'npx demovie make --about "the Projects board"',
    ],
    [
      "A short vertical teaser, without stopping for review",
      "npx demovie make --type teaser --format 9:16 --no-review",
    ],
    ["See the exact agent command without running it", "npx demovie make --agent codex --dry-run"],
  ],
  mcp: [["Start the MCP server (your agent's MCP config runs this)", "npx demovie mcp"]],
  "skill install": [
    ["Install or update the skill for your agents in this project", "npx demovie skill install"],
    ["Only for Codex", "npx demovie skill install --agent codex"],
  ],
  "ci init": [["Write a GitHub workflow that makes a clip on every release", "npx demovie ci init"]],
};

export function examplesHelp(examples: [string, string][]): string {
  return `\nExamples:\n${examples.map(([what, command]) => `  $ ${command}\n      ${what}`).join("\n")}\n`;
}
