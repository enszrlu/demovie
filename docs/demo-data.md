# Demo data

Videos show your product with data in it. demovie never invents that data: it captures what your app renders, so the
app needs a **demo seed** — a script that fills a fresh database (or fixture store) with believable, fictional data.

## Wiring it up

```jsonc
"demo": {
  "seed": "pnpm demo:seed",          // runs before the app starts and before every capture run
  "now": "2026-09-15T10:30:00.000Z"  // the page clock is frozen here, so "3 days ago" and charts stay stable
}
```

The seed must be **idempotent**: running it twice gives the same data. Flows that create things (a new project) then
replay cleanly on every capture.

## Writing good demo data

- **Fictional, never real.** No real customers, people, emails or companies. Use a reserved domain for emails
  (`@yourapp.demo`, `example.com`) and add it to `demo.mask.allow`.
- **Plausible and specific.** "Q3 Launch", "Billing migration", "Northwind" read better than "Project 1".
- **Varied states.** Some items on track, some at risk, one overdue; progress at 20%, 65%, 100%. Videos need contrast.
- **Dated relative to `demo.now`.** Generate dates from a fixed reference so charts and "due in 3 days" match the
  frozen clock.
- **Deterministic.** No `Math.random()` without a seed, no `Date.now()`.
- **A demo login.** One fixture user (e.g. `demo@yourapp.demo`) whose password lives in `.demovie/.env`.

Every number your video shows should appear in the captured UI, the glossary or the brief; QA rule `DM-G04` warns
about numbers it can't find there.

## Example

The `examples/harborly` fixture (`pnpm --filter harborly demo:seed`) seeds projects across four columns, people,
customers, activity and weekly velocity from one file, all relative to a fixed date.
