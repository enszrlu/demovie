<!-- Generated from packages/core/src/schemas/config.ts (the JSON Schema shipped as schema/config.schema.json) by scripts/build-docs.ts. Do not edit; run `pnpm docs:build`. -->
# Config reference: `.demovie/config.json`

`npx demovie init` writes this file; edit it freely. The JSON Schema ships with the package, and `$schema` points
at it (`../node_modules/demovie/schema/config.schema.json` when demovie is installed in the project, otherwise
`https://unpkg.com/demovie@<version>/schema/config.schema.json`), so editors validate and autocomplete it.

- Any string of the form `"$env:NAME"` resolves from the environment or `.demovie/.env` (gitignored).
- Secrets must only appear as `$env:` references.
- In CI, `DEMOVIE_APP_URL`, `DEMOVIE_APP_START` and `DEMOVIE_APP_HEADERS` override `app` (see [CI](ci.md)).

| Key | Type | Default | Description |
|---|---|---|---|
| `version` | `number` |  | config format version |
| `project` | `object` |  | the app demovie works on |
| `project.name` | `string` |  | product name used in videos |
| `project.framework` | `"nextjs" \| "generic"` |  | nextjs: routes from the file system; generic: crawl app.url |
| `project.root` | `string` | `"."` | the app folder, relative to the folder that holds .demovie/ |
| `project.nextjs` | `object \| null` |  | what init detected (Next.js only) |
| `project.nextjs.version` | `string \| null` |  | detected Next.js version |
| `project.nextjs.router` | `"app" \| "pages" \| "both"` |  | which routers the app uses |
| `project.nextjs.appDir` | `string \| null` |  | App Router folder, e.g. src/app |
| `project.nextjs.pagesDir` | `string \| null` |  | Pages Router folder, e.g. pages |
| `project.nextjs.basePath` | `string \| null` |  | next.config basePath |
| `project.nextjs.i18n` | `object \| null` |  | next.config i18n (Pages Router) |
| `project.nextjs.i18n.locales` | `string[]` |  |  |
| `project.nextjs.i18n.defaultLocale` | `string \| null` |  |  |
| `project.nextjs.output` | `string \| null` |  | next.config output, e.g. "standalone" |
| `app` | `object` |  | how to reach and start the app |
| `app.url` | `string` |  | where the running app answers |
| `app.start` | `object \| null` | `null` | how up and capture start the app; null when you start it yourself |
| `app.start.command` | `string` |  | starts the app, e.g. pnpm dev |
| `app.start.cwd` | `string` | `"."` | folder to run it in, relative to the project |
| `app.start.env` | `record<string, string>` | `{}` | extra environment variables |
| `app.start.readyPath` | `string` | `"/"` | path polled until the app answers |
| `app.start.timeoutMs` | `integer` | `120000` | how long to wait for readyPath |
| `app.reuseRunning` | `boolean` | `true` | use the app if it already answers at url |
| `app.headers` | `record<string, string>` | `{}` | extra HTTP headers; secrets as "$env:NAME" references |
| `demo` | `object` | `{}` | demo mode: seeded data, frozen clock, hidden and masked content |
| `demo.seed` | `string \| null` | `null` | optional seed command; runs before start/capture |
| `demo.now` | `string \| null` | `null` | frozen page clock for captures |
| `demo.timezone` | `string` | `"UTC"` | browser timezone for captures |
| `demo.locale` | `string` | `"en-US"` | browser locale for captures |
| `demo.colorScheme` | `"light" \| "dark" \| "both"` | `"light"` | color schemes to capture |
| `demo.hide` | `string[]` | `[]` | CSS selectors hidden before screenshots (cookie banners, chat) |
| `demo.blockRequests` | `string[]` | see example | URL patterns (* wildcards) aborted during capture |
| `demo.mask` | `object` | `{}` | redaction of personal data in captures |
| `demo.mask.patterns` | `("email" \| "phone" \| "secret")[]` | `["email","phone","secret"]` | kinds of text replaced before screenshots |
| `demo.mask.selectors` | `string[]` | `[]` | CSS selectors whose text is masked entirely |
| `demo.mask.allow` | `string[]` | `[]` | values never masked, e.g. *@harborly.demo |
| `demo.mask.replacement` | `"fictional" \| "dots"` | `"fictional"` | fictional look-alikes of similar length, or ••• |
| `demo.mask.enabled` | `boolean` | `true` | turn redaction off only for fully fictional apps |
| `auth` | `object` | `{}` | how captures log in to protected pages |
| `auth.strategy` | `"none" \| "form" \| "storageState" \| "script"` | `"none"` | form: fill the login page; storageState: a session saved by auth record; script: your own code |
| `auth.loginPath` | `string \| null` | `null` | login page path (form) |
| `auth.usernameEnv` | `string` | `"DEMOVIE_USER"` | env var holding the demo username (form) |
| `auth.passwordEnv` | `string` | `"DEMOVIE_PASSWORD"` | env var holding the demo password (form) |
| `auth.successPath` | `string \| null` | `null` | path reached after a successful login |
| `auth.script` | `string \| null` | `null` | auth script path (script); default .demovie/auth.ts |
| `capture` | `object` | `{}` | screenshots and element maps |
| `capture.viewports` | `record<string, object>` | see example | named viewports |
| `capture.defaultViewports` | `string[]` | `["desktop"]` | viewports captured when --viewport isn't given |
| `capture.routes` | `object` | `{}` | which routes capture visits |
| `capture.routes.include` | `string[]` | `["**"]` | route globs to capture |
| `capture.routes.exclude` | `string[]` | `["/api/**"]` | route globs to skip |
| `capture.routes.params` | `record<string, string[]>` | `{}` | values for dynamic routes, e.g. { "/app/projects/[id]": ["prj_launch"] } |
| `capture.fullPage` | `string[]` | `[]` | route globs that also get a full-page screenshot |
| `capture.waitFor` | `record<string, string>` | `{}` | per-route CSS selector to wait for, e.g. { "/app": "main" } |
| `capture.concurrency` | `integer` | `3` | pages captured in parallel |
| `capture.crawl` | `object` | `{}` | route discovery for generic apps |
| `capture.crawl.maxPages` | `integer` | `50` | most pages a generic-mode crawl visits |
| `capture.crawl.maxDepth` | `integer` | `3` | most links followed from app.url |
| `video` | `object` | `{}` | defaults for demovie new |
| `video.fps` | `integer` | `30` | frame rate of new videos |
| `video.formats` | `("16:9" \| "9:16" \| "1:1" \| "4:5")[]` | `["16:9","9:16"]` | formats of new videos |
| `video.style` | `"clean" \| "bold" \| "soft" \| "editorial" \| "terminal"` | `"clean"` | style preset of new videos |
| `audio` | `object` | `{}` | default audio providers |
| `audio.music` | `object` | `{}` | background music |
| `audio.music.provider` | `"synth" \| "elevenlabs" \| "file" \| "none"` | `"synth"` | synth: free and local; elevenlabs: your key; file: a track imported with add --licensed |
| `audio.voice` | `object` | `{}` | voiceover |
| `audio.voice.provider` | `"none" \| "elevenlabs" \| "openai"` | `"none"` | voiceover provider; uses your API key after you approve the cost |
| `audio.voice.voiceId` | `string \| null` | `null` | provider voice id (default: the provider's) |
| `audio.voice.model` | `string \| null` | `null` | provider model id (default: the provider's) |
| `agents` | `("claude" \| "codex" \| "cursor")[]` | `[]` | agents init set up the skill and MCP for |

## Example (the Harborly fixture)

```json
{
  "$schema": "https://unpkg.com/demovie@0.1.0/schema/config.schema.json",
  "version": 1,
  "project": {
    "name": "Harborly",
    "framework": "nextjs",
    "root": ".",
    "nextjs": {
      "version": "16.3.8",
      "router": "app",
      "appDir": "src/app",
      "pagesDir": null,
      "basePath": null,
      "output": null
    }
  },
  "app": {
    "url": "http://localhost:3000",
    "start": {
      "command": "pnpm dev",
      "cwd": ".",
      "env": {
        "DEMO_MODE": "1"
      },
      "readyPath": "/",
      "timeoutMs": 120000
    },
    "reuseRunning": true,
    "headers": {}
  },
  "demo": {
    "seed": "pnpm demo:seed",
    "now": "2026-09-15T10:30:00.000Z",
    "timezone": "UTC",
    "locale": "en-US",
    "colorScheme": "light",
    "hide": [".cookie-banner", "#intercom-container"],
    "blockRequests": [
      "*google-analytics.com*",
      "*googletagmanager.com*",
      "*posthog.com*",
      "*segment.io*",
      "*hotjar.com*"
    ],
    "mask": {
      "patterns": ["email", "phone", "secret"],
      "selectors": [],
      "allow": ["*@harborly.demo"],
      "replacement": "fictional",
      "enabled": true
    }
  },
  "auth": {
    "strategy": "form",
    "loginPath": "/login",
    "usernameEnv": "DEMOVIE_USER",
    "passwordEnv": "DEMOVIE_PASSWORD",
    "successPath": "/app",
    "script": null
  },
  "capture": {
    "viewports": {
      "desktop": {
        "width": 1440,
        "height": 900,
        "deviceScaleFactor": 2
      },
      "mobile": {
        "width": 390,
        "height": 844,
        "deviceScaleFactor": 3,
        "isMobile": true
      }
    },
    "defaultViewports": ["desktop"],
    "routes": {
      "include": ["**"],
      "exclude": ["/api/**"],
      "params": {
        "/app/projects/[id]": ["prj_launch"]
      }
    },
    "fullPage": ["/", "/pricing"],
    "waitFor": {
      "/app": "[data-testid=velocity-chart] svg",
      "/app/reports": "main svg",
      "/app/projects/[id]": "[data-testid=project-velocity] svg"
    },
    "concurrency": 3,
    "crawl": {
      "maxPages": 50,
      "maxDepth": 3
    }
  },
  "video": {
    "fps": 30,
    "formats": ["16:9", "9:16"],
    "style": "clean"
  },
  "audio": {
    "music": {
      "provider": "synth"
    },
    "voice": {
      "provider": "none",
      "voiceId": null,
      "model": null
    }
  },
  "agents": ["claude", "codex", "cursor"]
}
```
