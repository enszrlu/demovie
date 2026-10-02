# Example: editorial-launch (style `editorial`, 31 s, 16:9 + 9:16)

Source: `examples/compositions/editorial-launch/`. "Velocity insights are here" — a magazine-like announcement: large
display type on warm paper, hairline rules, borderless screenshots bleeding off the edge like figures, slow 1.0–1.4 s
moves and page-turn wipes, over minimal synthesized music (90 BPM). Four real captures, including a full-page capture
of the homepage. QA: 0 errors, 0 warnings in both formats.

## Shots

| # | Bars | Kind | What happens |
|---|---|---|---|
| 1 | 0–2 | title | Cover: the dashboard's Velocity chart as the cover image; "What's new in Harborly", a hairline, the headline rising line by line. |
| 2 | 2–5 | product | The homepage as a figure: a ring on its "Velocity insights are here" announcement, then a slow scroll to the feature cards. |
| 3 | 5–7.5 | product | The changelog: a slow push onto the Version 2.8 entry. |
| 4 | 7.5–10 | product | Reports: a push onto the Velocity chart and a margin note, "Completed vs. committed". |
| 5 | 10–end | logo | Back cover: wordmark as masthead, the tagline, an underlined call to action. |

## A shared grid: the figure positions the copy

```js
const figure = { width: figureWidth, x: v.width - figureWidth, y: vertical ? 760 : Math.round((v.height - figureHeight) / 2) };
v.stage.style.setProperty("--figure-x", `${figure.x}px`);
v.stage.style.setProperty("--figure-top", `${figure.y}px`);
v.stage.style.setProperty("--figure-bottom", `${figure.y + figureHeight}px`);
```

Why: the screenshot is placed once per format and exported as CSS variables, so every spread's pull quote and caption
hang off the same lines — consistent whitespace is most of the editorial look.

## Real copy from real pages

```js
const home = spread("home", bar(2), bar(5), { quote: "One calm workspace for every launch.", caption: "The Harborly homepage",
  capture: "routes/index@desktop", image: "full" });
home.app.highlight("link:new-velocity-insights-are-here", { at: bar(2) + 1.2, duration: 2.0, style: "ring" });
home.app.scroll("heading:everything-a-launch-needs-in-one-place", { at: bar(3) + 0.2, duration: 2.6, ease: MOVE });
```

Why: the pull quotes are lines from the product's own pages and glossary, and `image: "full"` with `scroll()` moves
through the real full-page capture instead of a stitched or redrawn page.

## Slow, deliberate motion

```js
const SETTLE = "power3.out";
const MOVE = "power2.inOut";
function drawRule(el, at) {
  tl.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 1.3, ease: MOVE }, at);
}
changelog.app.focus(entry, { at: bar(5) + 1.0, duration: 1.4, scale: zoomFor(entry), ease: MOVE });
```

Why: editorial moves take 1.0–1.4 s, ease in and out, and hold; one thing moves at a time.

## Margin notes with `callout`

```js
callout(reports.app, "application", { label: "Completed vs. committed", at: bar(7.5) + 2.6,
  duration: bar(10) - bar(7.5) - 3.3, side: vertical ? "bottom" : "left" });
```

Why: the label is the chart's own legend text, attached to the real element; it follows the camera.

## The opening frame is already a page

The first frame shows the cover image and the hairline beginning to draw, so the video never opens on a blank page
(QA `DM-R02` flags frames that are more than 98% one color for over 0.3 s).
