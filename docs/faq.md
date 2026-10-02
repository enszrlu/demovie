# FAQ

## Why not just prompt a frontier model for a product video?

A one-prompt video looks impressive and is wrong: the model has never seen your product, so it redraws a generic
dashboard, invents features, metrics and customers, and wraps it in HUD labels and purple gradients. demovie gives the
model your real app — screenshots, element maps, your brand and vocabulary — and then checks the result (QA) so it
stays true. See the side-by-side in the README.

## Why not Remotion?

Remotion is free only for individuals, non-profits and companies of up to three people; larger companies need a paid
license. demovie is MIT, so anyone can use it. Compositions are plain HTML + GSAP, rendered frame by frame with
Playwright and your system ffmpeg. See [licensing and terms](licensing-and-terms.md).

## Does it use my Claude (or ChatGPT, or Cursor) subscription?

demovie itself never logs in to any AI service and never reads tokens. Your agent — which you installed and signed in
to — uses demovie as a tool. `demovie make` just starts that agent for you. In CI the action passes through API keys.

## Where does my data go?

Nowhere. Captures, videos and caches stay in your repository's `.demovie/` folder (captures, caches and outputs are
gitignored). There is no telemetry. The only network calls are to your own app, and — only if you configure them and
approve the cost — to ElevenLabs or OpenAI for voiceover or music, and whatever your agent does on its own.

## Which frameworks are supported?

Next.js (App and Pages Router) is detected automatically, including route groups, dynamic routes, middleware/proxy
protection and monorepos. Any other web app works in generic mode: `npx demovie init --url http://localhost:5173`.

## Can I edit the video by hand?

Yes. `composition/main.js` is ordinary JavaScript with GSAP; `npx demovie preview <slug>` hot-reloads as you edit.
