# Concepts

## Grounding levels

The more of your real product demovie can see, the more truthful the video. Each level adds evidence the agent must
use instead of imagining:

| Level | What demovie has | What the video can show |
|---|---|---|
| **L0 — brand** | `brand.json` (colors, fonts, logo) and `glossary.md` from your code | On-brand titles and type, your product's words. No product UI. |
| **L1 — public pages** | Captures of public routes (landing, pricing, changelog) | Real marketing pages, real copy and numbers. |
| **L2 — logged-in captures** | Captures of the app behind login with seeded demo data | The real product: dashboards, lists, settings — with element maps for exact cursor and camera targets. |
| **L3 — flows** | Multi-step journeys replayed and captured state by state | Real interactions: click → dialog → typed input → result, each state a real screenshot. |

`npx demovie status` tells you which level a project has reached and what to do next.

## Captures and element maps

A capture is one state of the running app: `screen.png` (at device scale factor 2), `elements.json` (every visible
element's role, accessible name, text, box and style, with a stable id), and `meta.json` (URL, viewport, time,
redactions). Ids look like `button:create-project`, `link:q3-launch` or `dm:project-checklist` (from a
`data-demovie` attribute). Compositions target these ids, so a cursor click lands exactly on the real button.

Captures are deterministic: the page clock is frozen (`demo.now`), demo data is re-seeded, analytics are blocked, fonts
and images are waited for, and personal data is masked before the screenshot. Captures are marked stale when the
route's source files, the layout chain or the config change.

## Compositions

A video is an HTML page (`composition/index.html`, `main.js`, `styles.css`) built with the demovie runtime and GSAP.
Product UI only enters through `screen()` with a capture id; the runtime handles device frames, camera moves, cursors,
typing, highlights, captions, transitions and the logo. Everything is a pure function of time, so the renderer can
seek any frame in any order.

## QA

`npx demovie qa <slug>` samples the composition at 10 fps and runs 30 rules: reading time, text size, contrast, safe
areas, overlaps, pacing, end hold, truthful cursor clicks, invented words and numbers, upscaled captures, fonts,
network, determinism, blank frames, stray animations, audio loudness and provenance, and the "AI look" clichés. The skill
requires 0 errors before the final render; each failure comes with a fix hint. See [QA rules](qa-rules.md).

## Audio

Music is synthesized locally (deterministic, license-clean) and follows the storyboard; SFX are a bundled CC0 set;
voiceover uses your own ElevenLabs or OpenAI key after you approve the cost. Every audio file has a provenance entry.
See [audio](audio.md).

## The agent layer

demovie ships an Agent Skill (instructions + references), an MCP server, and `demovie make`, which launches the agent
CLI you already use. demovie never logs in to AI services or touches your subscriptions. See [agents](agents.md).
