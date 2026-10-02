# Flows: capturing states behind clicks

A flow replays a user journey in the real app and captures named states along the way. Each captured state becomes a
capture id `flows/<flow>@<viewport>/<state>` with its own `screen.png` and `elements.json`.

```bash
npx demovie flow new create-project --start /app/projects   # writes .demovie/flows/create-project.flow.yaml
npx demovie flow run create-project        # run one flow (captures its states)
npx demovie capture --flow create-project  # same, as part of a capture run
```

## YAML flows

```yaml
# .demovie/flows/create-project.flow.yaml
name: create-project
start: /app/projects          # path opened first (after login for protected routes)
viewport: desktop             # optional; default: the first default viewport
description: Create a project from the Projects board
steps:
  - capture: board
  - click: { testId: new-project }
  - waitFor: { role: dialog }
  - capture: dialog
  - fill: { label: Project name, value: Q4 Launch }
  - click: { role: button, name: Create project }
  - waitFor: { url: /app/projects/prj_q4-launch }
  - waitFor: { text: Launch checklist }
  - capture: created
  - hover: { testId: project-checklist }
  - capture: checklist-hover
```

**Targets** need exactly one locator: `{ role, name }`, `{ label }`, `{ text }`, `{ testId }`, `{ placeholder }`,
`{ css }`, or `{ element: <id from an elements.json> }`. Add `exact: true` or `nth: 1` to disambiguate.

**Steps**: `goto`, `click`, `dblclick`, `fill` (`value`), `press` (`"Enter"` or `{ key, target }`), `hover`, `select`
(`value`), `check`, `uncheck`, `scroll` (pixels, or `{ to: target }`), `wait` (ms; avoid), `waitFor` (a target,
`{ url }` or `{ hidden: target }`), `capture` (a name, or `{ name, fullPage: true }`).

Rules:

- Wait for the result of each action (`waitFor`) before capturing; demovie also waits for network idle, fonts, images
  and animations before every capture.
- Use the seeded demo data and values that read well on screen ("Q4 Launch"). Demo data is re-seeded before each run,
  so flows that create things are repeatable.
- Destructive-looking steps (delete, remove, cancel subscription, …) are refused unless the flow sets
  `allowDestructive: true` — and only do that against demo data.
- After capturing, **open the PNGs** in `.demovie/captures/flows/<flow>@<viewport>/` and check every state.

## TypeScript flows

For logic YAML can't express, write a TypeScript flow (`npx demovie flow new <name> --ts` scaffolds
`.demovie/flows/<name>.flow.ts`). `capture` and `flow run` load it as is; for types in the editor, add demovie as a dev
dependency (`npm i -D demovie`), which provides `demovie/flow`:

```ts
import { defineFlow } from "demovie/flow";

export default defineFlow({
  name: "invite-teammate",
  start: "/app/team",
  run: async ({ page, capture, step }) => {
    await capture("team");
    await step("click", page.getByRole("button", { name: "Invite" }), (target) => target.click());
    await page.getByLabel("Email").fill("sam@harborly.demo");
    await capture("invite-dialog");
  },
});
```

`step(action, locator, fn)` records the action and its target for cursor paths; `capture(name)` saves a state.

## Element ids

Every capture's `elements.json` lists visible elements with stable ids:

- `dm:<value>` for elements with a `data-demovie="<value>"` attribute (most stable; ask before adding them to app code);
- `<role>:<slug of accessible name>` (e.g. `button:create-project`, `link:q3-launch`, `textbox:project-name`);
- `#2`, `#3` suffixes for duplicates.

Use these ids for `cursor.moveTo`, `screen.focus`, `highlight`, `typeText` and `callout`. Unknown ids throw with the
nearest valid ids.
