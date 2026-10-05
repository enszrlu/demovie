---
"demovie": patch
---

Starting and stopping your app is more reliable. When `capture`, `up`/`down` or `auth` stop the app, demovie now waits until its whole process tree has exited, so a dev server that is still shutting down (Next.js writes its cache first) no longer holds the port and answers the next run with 404s. If another server already answers at `app.url`, demovie now says so right away instead of starting a second copy and waiting for the timeout.
