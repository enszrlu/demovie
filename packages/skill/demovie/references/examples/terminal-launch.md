# Example: terminal-launch (style `terminal`, 28 s, 16:9 + 9:16)

Source: `examples/compositions/terminal-launch/`. "Every launch, path by path" — a terminal window beside a
dark-framed browser over a grid: the terminal types the path of a real screen, then the values that screen shows,
while the browser frames and rings the same values. Mono type throughout, tech synthesized music (120 BPM), a key
click per typed character. Three real captures. QA: 0 errors, 0 warnings in both formats.

## Shots

| # | Bars | Kind | What happens |
|---|---|---|---|
| 1 | 0–2 | title | `// Harborly`, then the tagline typed with a block caret. |
| 2 | 2–5.5 | product | `› /app` and the dashboard's KPI values (Active projects 9 … Avg. velocity 35.5); the browser rings the KPI row. |
| 3 | 5.5–9 | product | `› /app/projects/prj_launch` and the Q3 Launch header values; the header is ringed. |
| 4 | 9–12 | product | `› /app/settings` and the page's own line about API keys; the (masked) key field is ringed. |
| 5 | 12–end | logo | The wordmark on a light badge, then `› Start free trial` typed with a caret. |

## Typed output that is true

```js
const dashboard = session("dashboard", bar(2), bar(5.5), {
  capture: "routes/app@desktop",
  path: "/app",
  output: `Active projects        9
On track               6
Launches this quarter  5
Avg. velocity          35.5`,
});
dashboard.app.highlight("dm:dashboard-kpis", { at: bar(2) + 1.0, duration: 5.4, style: "ring" });
```

Why: the terminal is a stylistic frame, not invented output — every value is read off the capture shown next to it
(and listed in the brief), and the ring on `dm:dashboard-kpis` proves it. Fake logs, fake commands or invented numbers
would fail the truth rubric (and QA `DM-G04`).

## A typing caret that is a pure function of time

```js
function type(el, at, until, cps) {
  text.reveal(el, { at, by: "char", from: "fade", duration: 0.001, stagger: 1 / cps, ease: "none" });
  const chars = [...el.querySelectorAll(".dm-char")];
  const caret = add(el, `<span class="caret"></span>`);
  const stops = chars.map((c) => ({ x: c.offsetLeft + c.offsetWidth, y: c.offsetTop }));
  const done = at + chars.length / cps;
  v.onSeek((t) => {
    const typed = Math.max(0, Math.min(chars.length, Math.floor((t - at) * cps) + 1));
    const blink = t >= done && Math.floor((t - done) / 0.5) % 2 === 1;
    caret.style.visibility = t >= at && t < until && !blink ? "inherit" : "hidden";
    caret.style.transform = `translate(${stops[typed - 1]?.x ?? 0}px, ${stops[typed - 1]?.y ?? 0}px)`;
  });
  return done;
}
```

Why: the blink is computed from `t` in `v.onSeek`, never with a CSS animation or a timer, so any frame renders the
same in any order (QA `DM-R01`, `DM-R04`, `DM-R05`).

## Sound that matches the typing

`video.json` has one `type-key` cue per typed character (`at + i / cps`), a `swipe` on each push and a `tick` when a
readout lands — the audio is derived from the same schedule as the visuals.

## Element ids from `data-demovie`

`dm:dashboard-kpis` and `dm:project-header` come from `data-demovie` attributes in Harborly's markup — the most stable
targets an element map can offer. Ask before adding such attributes to an app.
