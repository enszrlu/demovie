# Bundled fallback fonts

demovie ships these fonts so compositions never fall back to system fonts silently (SPEC §5.4, QA rule DM-A01).
All are licensed under the SIL Open Font License 1.1; the license texts sit next to the files.

| File | Family | Source |
|---|---|---|
| `inter-variable.woff2` | Inter (latin, variable weight) | `@fontsource-variable/inter` (OFL-1.1) — `OFL-Inter.txt` |
| `geist-variable.woff2` | Geist (variable weight) | `geist` npm package by Vercel (OFL-1.1) — `OFL-Geist.txt` |
| `geist-mono-variable.woff2` | Geist Mono (variable weight) | `geist` npm package by Vercel (OFL-1.1) — `OFL-Geist.txt` |

They are copied from the npm packages (never downloaded at render time); `pnpm --filter @demovie/runtime vendor-fonts` refreshes them.
