# CI: a clip for every release

## The GitHub Action

```bash
npx demovie ci init     # writes .github/workflows/demovie.yml (asks first; --yes to skip)
```

The generated workflow runs on `release: published` and `workflow_dispatch` (and, if you uncomment it,
`deployment_status` for Vercel previews). It uses the composite action in `packages/action`:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0                       # tags and history for `demovie changes`
- uses: <owner>/demovie/packages/action@v0
  with:
    agent: claude                        # or codex
    type: changelog
    app-url: ${{ github.event.deployment_status.environment_url }}   # or `start: pnpm build && pnpm start`
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}              # an API key, not a subscription
    DEMOVIE_USER: ${{ secrets.DEMOVIE_USER }}
    DEMOVIE_PASSWORD: ${{ secrets.DEMOVIE_PASSWORD }}
```

Inputs: `agent`, `agent-version` (pin it), `type`, `formats`, `since` (default: the previous tag), `app-url` or
`start`, `working-directory`, `comment` (default true), `upload-release-asset` (default true on releases),
`node-version` (default 22).

What it does:

1. Sets up Node and pnpm (with cache) and installs your dependencies.
2. Installs the agent CLI at the pinned version.
3. Installs Chromium (`npx -y playwright@1.60.0 install --with-deps chromium`) and ffmpeg if missing.
4. `demovie doctor`, then `demovie capture --changed --since <ref>`.
5. `demovie changes --since <ref>` for the story, then `demovie make --agent … --type changelog --yes`.
6. Uploads `out/` as a workflow artifact.
7. Comments on the pull request (or writes the job summary) with the poster, links and the QA summary.
8. On releases, attaches the MP4s and posters to the release (`gh release upload`).

## Vercel previews

Set `app-url` from `github.event.deployment_status.environment_url` and add the
`VERCEL_AUTOMATION_BYPASS_SECRET` secret: the action sends it as `x-vercel-protection-bypass` with
`x-vercel-set-bypass-cookie: true` on every request to the preview.

## Overrides for any CI

The CLI reads these environment variables, so other CI systems can do the same as the action:

| Variable | Effect |
|---|---|
| `DEMOVIE_APP_URL` | Use an already running app at this URL (no start command). |
| `DEMOVIE_APP_START` | Replace `app.start.command`. |
| `DEMOVIE_APP_HEADERS` | JSON object of extra request headers (treated as secrets). |
| `CI` | Implies `--yes` (no prompts). |

## `demovie changes`

```bash
npx demovie changes --since v1.2.0 --json
```

Lists commits (conventional-commit type, scope, subject, PR numbers; PR titles via `gh` when available), changed
files, and the routes they affect — directly (a page or layout changed) or through the import graph (a shared
component used by a page, tsconfig `paths` resolved, up to 6 imports deep) — plus the captures and flows to refresh
and a one-line story of the user-visible changes.
