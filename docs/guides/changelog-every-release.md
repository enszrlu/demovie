# A video for every release

Once demovie is set up in your repository, a GitHub Action can make a short changelog clip whenever you publish a
release: it finds what changed, recaptures only the affected screens, has your agent make the clip, and attaches it to
the release.

## 1. Commit the setup

Commit `.demovie/` (the generated `.gitignore` keeps credentials, captures and renders out) and, if you have them,
your flows. The workflow needs the same config you use locally.

## 2. Add the workflow

```bash
npx demovie ci init
```

This writes `.github/workflows/demovie.yml`, which runs on `release: published` and on demand from the Actions tab. It
pins the agent's version and passes your app's folder in a monorepo. Read it before committing; it's short.

## 3. Add the secrets

In your repository, open **Settings → Secrets and variables → Actions**, and add:

| Secret | Why |
|---|---|
| `ANTHROPIC_API_KEY` (Claude) or `OPENAI_API_KEY` (Codex) | The agent runs with an API key in CI, not your subscription. |
| `DEMOVIE_USER`, `DEMOVIE_PASSWORD` | Your demo account, if the app needs a login. |

If your app needs a database or other services to run in CI, start them in the workflow before the demovie step, the
same way your end-to-end tests do.

## 4. Try it

Run the workflow from the **Actions** tab, or publish a release. The run:

1. installs your dependencies, the agent CLI, Chromium and ffmpeg;
2. runs `demovie doctor`, then `demovie capture --changed --since <previous tag>`;
3. reads `demovie changes` for what changed, and asks your agent for a changelog clip about it;
4. uploads the video folder as a workflow artifact, comments on the pull request or writes the job summary, and
   attaches the MP4s and posters to the release.

## Locally first

You can produce the same clip on your laptop before relying on CI:

```bash
npx demovie changes --since v1.2.0        # what changed, and which pages it touched
npx demovie capture --changed --since v1.2.0
npx demovie make --type changelog --about "what changed since v1.2.0"
```

## Previews and other CI systems

Pointing at a preview deployment (Vercel and others), the inputs of the action and the environment variables other CI
systems can use are in the [CI reference](../ci.md).
