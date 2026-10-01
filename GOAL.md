# Building demovie with `/goal`

`/goal` keeps Claude Code working turn after turn until a completion condition holds. After each turn, a small model checks that condition against the conversation. It does not run commands itself, so the condition below asks Claude to *show* the evidence: verify output, QA results, and git status.

## Run it

1. Open Claude Code in this folder:
   ```bash
   cd ~/Desktop/demovie-oss && claude --model claude-opus-5-5
   ```
2. Switch to **auto mode**, so goal turns run without permission prompts.
3. Paste the goal below. It is about 1,400 characters; the limit is 4,000.

## The full goal (all milestones)

```text
/goal Build demovie exactly as specified in SPEC.md. First read SPEC.md, AGENTS.md, PROGRESS.md and DECISIONS.md. Work through milestones M0–M9 in order; after each milestone update PROGRESS.md, run `pnpm verify`, and make a local git commit `feat(mN): …`. The goal is met only when this conversation shows all of the following, from commands run after the last code change: (1) `pnpm verify` exits 0 and its final line is `VERIFY OK (<n> checks)`, with no check pending or skipped except live paid-API tests that skip because keys are absent; (2) `pnpm verify:dogfood` exits 0, printing ffprobe summaries for the Harborly launch video (16:9 and 9:16) and the changelog clip, with `demovie qa` reporting 0 errors for each; (3) PROGRESS.md shows every acceptance box for M0–M9 checked; (4) `git status --porcelain` prints nothing and `git log --oneline` shows one commit per milestone. Constraints: never publish to npm, never push to any remote, never create accounts or use real credentials, never add Remotion or any GPL/AGPL/LGPL dependency, never implement AI-vendor login/OAuth/subscription-token handling, never modify files outside this repository. Tests that need paid API keys must skip cleanly when keys are absent. When SPEC.md doesn't settle a decision, choose the simplest option consistent with its principles, record it in DECISIONS.md, and keep going instead of stopping to ask.
```

To cap the time or cost, append a clause such as ` Or stop after 300 turns and report status.`

## Alternative: one milestone per goal (more control, easier to review)

Set this goal once for each milestone, replacing `N`:

```text
/goal Complete milestone MN of SPEC.md (read SPEC.md, AGENTS.md, PROGRESS.md, DECISIONS.md first). Done when this conversation shows: every MN acceptance box in PROGRESS.md checked; `pnpm verify` exiting 0 (checks for later milestones may show `pending`, none may fail); and a local commit `feat(mN): …` with `git status --porcelain` empty. Same constraints as the full goal in GOAL.md: no npm publish, no git push, no accounts or real credentials, no Remotion or GPL-family deps, no AI-vendor auth handling, no edits outside this repo; record undecided choices in DECISIONS.md and continue.
```

Review the result after each milestone, then run the next one.

M8 (dogfood) is where the video quality gets judged. Watch the outputs in `examples/harborly/.demovie/videos/*/out/` yourself before moving on to M9.

## Headless (optional)

```bash
claude -p "/goal <paste condition>" --output-format stream-json --verbose
```
