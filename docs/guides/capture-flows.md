# Capture states behind clicks (flows)

`npx demovie capture` photographs every page as it loads. Many of the best moments in a product video only appear after
an action: a dialog, a filled form, a result. A **flow** replays those steps in the real app and captures each state on
the way.

## 1. Pick the moments

Write down the states you want to show, in order. For a "create a project" story:

1. the board, before anything happens;
2. the "New project" dialog;
3. the dialog with a name typed in;
4. the new project's page.

## 2. Scaffold the flow

```bash
npx demovie flow new create-project --start /app/projects
```

This writes `.demovie/flows/create-project.flow.yaml`, starting on the page you name (after logging in, if that page
needs it).

## 3. Write the steps

Each step acts on one element, found the way a person would describe it: by its role and name, its label or its text.

```yaml
name: create-project
start: /app/projects
steps:
  - capture: board
  - click: { role: button, name: New project }
  - waitFor: { role: dialog }
  - capture: dialog
  - fill: { label: Project name, value: Q4 Launch }
  - capture: dialog-filled
  - click: { role: button, name: Create project }
  - waitFor: { text: Launch checklist }
  - capture: created
```

How to find the right target:

- **Look at a capture's `elements.json`.** Every element is listed with its role and name: `button:new-project` means
  `{ role: button, name: New project }`.
- **Prefer roles, labels and visible text** over CSS selectors: they survive redesigns.
- **`testId`** works for elements with a `data-testid`. For elements with neither a name nor a test id, ask your team
  before adding a `data-demovie="…"` attribute to the app.
- **Wait for the result** of each action (`waitFor`) before the next `capture`.

The full list of steps and targets is in the [flows reference](../../packages/skill/demovie/references/flows.md).

## 4. Run it and look

```bash
npx demovie flow run create-project
```

Each state lands in `.demovie/captures/flows/create-project@desktop/<state>/screen.png`. Open them. If a state shows a
spinner or the wrong screen, add a `waitFor` before its `capture`.

From now on, `npx demovie capture` runs the flow with everything else, and your agent can use
`flows/create-project@desktop/dialog` like any other capture.

## Good to know

- **Demo data is reloaded before every run**, so a flow that creates something can run again and again.
- **Destructive steps** (delete, remove, cancel…) are refused unless the flow sets `allowDestructive: true`. Only do
  that against demo data.
- **Logic YAML can't express?** `npx demovie flow new checkout --ts` writes a TypeScript flow instead.
