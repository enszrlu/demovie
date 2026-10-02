# Brief template

`npx demovie new` writes `brief.md`. Fill it in the product's own words (from `.demovie/glossary.md`). The brief is
also QA vocabulary: words and numbers in it may appear on screen, so keep it truthful.

```markdown
---
type: launch
duration: 35
formats: ["16:9", "9:16"]
style: clean
audience: Product and launch leads at software teams who plan launches in docs and spreadsheets
goal: Show that the Projects board puts every launch in one place
message: Every launch, from planning to launched, on one board.
cta: Start free trial — harborly.example
voice: false
music: true
references: []
resources: []
about: The Projects board in Harborly
---

## Context
What the product does, for whom, and why this video now. Two or three sentences, using glossary terms.

## Key points
1. One point per product shot, each provable with a real capture (name the route or flow).
2. …
3. …
```

Rules of thumb:

- **One message.** If you need "and", you have two videos.
- **At most 3 key points**, each mapped to a capture you have looked at.
- **CTA**: a real action and URL from the glossary (`ctaUrl`) or the user.
- `voice: true` only if the user wants VO and a provider key is configured.
- For changelogs add a `## What's new` section from `npx demovie changes --json`.
- In interactive sessions, confirm the brief with the user in one short message before capturing.
