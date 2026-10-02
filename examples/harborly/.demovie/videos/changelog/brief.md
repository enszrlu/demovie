---
type: changelog
duration: 15
formats: ["16:9","1:1"]
style: clean
audience: Harborly customers who track launches on the Projects board
goal: Show the new health badges in the product
message: Health badges now show an icon, so health reads at a glance.
cta: "Start free trial — harborly.example"
voice: false
music: true
references: []
resources: []
about: "Health badges show an icon"
---

## Context
What's new in Harborly: every health badge (On track, At risk, Off track) now shows an icon — a check, an exclamation
mark or a cross — so a project's health reads at a glance, even without color. The badge is shared, so the change
appears on the Projects board, the new project dialog's board, a project's page and the dashboard's upcoming launches.

## Key points
1. Health badges show an icon on the Projects board (routes/app-projects@desktop: At risk and Off track cards).
2. The same badges on the dashboard's upcoming launches (routes/app@desktop).

## What's new
From `npx demovie changes --since HEAD~1` (and the M7 test branch commit `feat(projects): health badges show an icon (#42)`):
the shared `src/app/app/_components/badges.tsx` changed; affected routes /app, /app/projects, /app/projects/[id],
/app/projects/new; flow create-project.
