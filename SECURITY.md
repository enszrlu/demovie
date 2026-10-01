# Security policy

demovie runs locally. It has no telemetry, no accounts and no hosted service. It handles three kinds of sensitive material, and this policy covers all of them:

- **App credentials** for the test user it logs in with (`.demovie/.env`, `.demovie/.auth/`).
- **Provider API keys** you choose to configure, such as `ELEVENLABS_API_KEY` or `OPENAI_API_KEY`.
- **Captured screens** of your app, which may contain data (`.demovie/captures/`, gitignored by default).

## Supported versions

Security fixes land on the latest minor release of `demovie` and `@demovie/runtime`.

## Reporting a vulnerability

Please report vulnerabilities privately. Do not open a public issue.

1. Use GitHub's private vulnerability reporting ("Security" → "Report a vulnerability") on the demovie repository.
2. Include what you found, the version, how to reproduce it, and the impact you expect.

We aim to acknowledge reports within 3 working days and to ship a fix or mitigation within 30 days, depending on severity. We will credit you in the release notes unless you prefer otherwise.

## What we consider in scope

- Secrets printed to logs, errors, `--json` output, MCP responses or captures.
- Redaction failures for the documented patterns (emails, phone numbers, common secret formats).
- The preview, render or MCP servers being reachable from anything other than the local machine.
- Compositions able to make network requests outside the render sandbox.
- Path traversal in the static servers or in `demovie add`.
- Anything that makes demovie modify files outside the project folders it documents.

## Design guarantees

- Credentials live only in `.demovie/.env` or the process environment, and config files hold only `$env:NAME` references.
- `auth test` prints cookie names, never values.
- The preview and render servers bind to `127.0.0.1`; the MCP server uses stdio only.
- The render sandbox aborts every request that isn't served by the local render server.
- demovie never implements AI-vendor login and never reads or stores subscription tokens.
