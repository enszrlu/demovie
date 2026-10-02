# Apps with a login

Most products hide their best screens behind a login. demovie logs in with a **test account** before capturing,
masks personal data on every screen, and keeps credentials out of anything you commit.

## 1. Make a demo account and demo data

Use an account that only exists in your local or staging database, with realistic but fictional data: the kind of
data you'd be happy to show in an ad. If your project has a seed script, tell demovie about it in `init` (or set
`demo.seed` in `.demovie/config.json`) so every capture run starts from the same data. See [demo data](../demo-data.md).

Never use a real customer's account, and never point demovie at production.

## 2. Choose how demovie logs in

`npx demovie init` asks this; you can change it later in `.demovie/config.json` under `auth`.

| Your login | Strategy | What you do |
|---|---|---|
| Email and password form | `form` | Give the login page path and the test account. The password is stored in `.demovie/.env` (gitignored). |
| Google/GitHub sign-in, magic links, 2FA | `storageState` | Run `npx demovie auth record`, log in by hand in the browser it opens. The session is saved to `.demovie/.auth/` (gitignored). Repeat when it expires. |
| Anything else (several steps, a tenant picker, cookie banners) | `script` | Write `.demovie/auth.ts`: a function that logs in with Playwright. |
| No login | `none` | Nothing. |

## 3. Test it

```bash
npx demovie auth test
```

```
login works (form)
landing: http://localhost:3000/app
cookies: session
```

If it fails, the error says why and what to fix (wrong path, the success page never appeared, a field not found).

## 4. Capture

```bash
npx demovie capture
```

Every capture run logs in first, then visits the pages that need it. Before each screenshot, demovie replaces emails,
phone numbers and things that look like secrets with fictional values of the same length. `meta.json` next to each
screenshot lists what was masked. To mask more, add patterns or CSS selectors under `demo.mask` in the config.

## Several roles

When different screens need different users (an employee and a kitchen manager, say), use a `script` login that picks
the account from an environment variable, then capture each role's pages in turn:

```bash
export DEMOVIE_ROLE=employee
npx demovie auth test && npx demovie capture --route "/app/orders/**"
export DEMOVIE_ROLE=manager
npx demovie auth test && npx demovie capture --route "/app/reports/**"
```

The script and the full set of options are in [capture and auth](../capture-and-auth.md#several-roles).

## Where credentials live

- **`.demovie/.env`**: test passwords and keys. Gitignored, readable only by you.
- **`.demovie/config.json`**: only references, such as `"$env:DEMOVIE_PASSWORD"`, never values.
- **In CI**: repository secrets (`DEMOVIE_USER`, `DEMOVIE_PASSWORD`). See [CI](../ci.md).

demovie never logs in to your AI tools. When `npx demovie make` runs Claude Code without prompts, the agent is
also denied reading `.demovie/.env` and the saved session; other agents and interactive sessions follow your agent's
own permission settings.
