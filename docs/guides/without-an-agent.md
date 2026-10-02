# Build a video by hand

demovie is built for agents, but everything they do is a plain command and a plain web page. If you'd rather write
the animation yourself, this is the whole loop.

## 1. Scaffold

```bash
npx demovie new launch --type launch --style clean --about "the Projects board"
```

This creates `.demovie/videos/launch/`:

```
brief.md          # the angle, the hook, three key points, the call to action
storyboard.md     # one row per shot
video.json        # duration, fps, formats, the captures it uses, audio cues
composition/      # index.html, main.js, styles.css: a web page that draws any moment on request
```

It already runs: `new` picks the capture that best matches `--about` and builds a title, a product shot and an end card.

## 2. Watch it while you edit

```bash
npx demovie preview launch
```

A player opens in your browser. It reloads when you save, lets you scrub and step frame by frame, and shows safe areas
and QA problems on top of the video.

## 3. Write the animation

`composition/main.js` builds one GSAP timeline with the demovie runtime. The product only ever appears through
`screen()`, with a real capture, and every focus, cursor or highlight target is an element id from that capture's
`elements.json`:

```js
import { createVideo, cursor, logo, screen, text } from "/__demovie/runtime.js";

const v = await createVideo();

// 0–2.5 s: the hook, word by word
const hook = v.shot("hook", 0, 2.5, { kind: "title" });
hook.el.innerHTML = `<div class="dm-bg"></div><div class="center"><h1 class="dm-title">Every launch. One board.</h1></div>`;
text.reveal(hook.el.querySelector("h1"), { at: 0.1, by: "word", stagger: 0.12 });

// 2.5–9 s: the real Projects board, with the cursor on its real "New project" link
const product = v.shot("board", 2.5, 9, { kind: "product" });
const board = screen(v, { capture: "routes/app-projects@desktop", parent: product.el, device: "browser" });
board.focus("link:new-project", { at: 3.5, duration: 1.2 });
const pointer = cursor(v);
pointer.moveTo(board, "link:new-project", { at: 4.5, duration: 0.8 });
board.highlight("link:new-project", { at: 5.4, duration: 1.5, style: "ring" });
pointer.hide({ at: 8.4 });

// 9–12 s: logo and call to action
const end = v.shot("end", 9, 12, { kind: "logo" });
end.el.innerHTML = `<div class="dm-bg"></div><div class="center"><div class="logo"></div><p class="dm-cta" data-dm-cta>Start free trial</p></div>`;
logo(v, { at: 9.2, parent: end.el.querySelector(".logo") });

v.ready();
```

Rules that keep it renderable: everything is a pure function of time (tweens on `v.timeline`, no timers, no
`Math.random`; use `v.random(seed)`), and `v.ready()` comes last. The whole API, with examples, is in
[compositions](../compositions.md); the look of each style is in [styles](../styles.md).

## 4. Check it

```bash
npx demovie stills launch --every 1 --sheet    # one frame per second, as a contact sheet
npx demovie qa launch                          # legibility, contrast, timing, safe areas, invented words…
```

Fix what QA reports (each finding has a `fix:` line) until it shows 0 errors.

## 5. Add sound

```bash
npx demovie audio music launch     # a synthesized bed and beats.json (v.beat(n) and v.bar(n) read it)
npx demovie audio sfx --list       # bundled sound effects; add cues to video.json
npx demovie audio mix launch       # music + effects (+ voiceover) at −16 LUFS
```

## 6. Render

```bash
npx demovie render launch --quality draft --format 16:9   # quick check
npx demovie render launch                                 # every format, final quality
```

The MP4s and posters land in `.demovie/videos/launch/out/`. The reference compositions in
[`examples/compositions`](../../examples/compositions) are complete, annotated examples in each style.
