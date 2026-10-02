# @demovie/runtime

The browser runtime for [demovie](https://www.npmjs.com/package/demovie) compositions. It provides:

- a virtual clock that makes every frame a pure function of time;
- device frames, and camera moves to real elements from captures;
- a truthful cursor, typing, callouts and captions;
- transitions and five style presets (`clean`, `bold`, `soft`, `editorial`, `terminal`).

You don't install it in your app: `demovie preview`, `stills`, `qa` and `render` serve it to compositions.

```js
import { createVideo, screen } from "/__demovie/runtime.js";

const v = await createVideo();
const shot = v.shot("board", 0, 6, { kind: "product" });
const app = screen(v, { capture: "routes/app-projects@desktop", parent: shot.el, device: "browser" });
app.focus("link:q3-launch", { at: 1, duration: 1.2 });
v.ready();
```

The full API reference ships in this package's types (`src/index.ts`) and in the demovie docs (`docs/compositions.md`).

MIT licensed.
