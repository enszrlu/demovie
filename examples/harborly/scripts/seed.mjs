// Writes a rich, fictional, fully deterministic dataset to .data/db.json (or $HARBORLY_DB_PATH).
// Every person, company and project here is made up. Run with `pnpm demo:seed`.
import { scryptSync } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/** The "now" this dataset is written for. Captures freeze the browser clock to the same instant. */
const REFERENCE_NOW = "2026-09-15T10:30:00.000Z";

/** Same scheme as src/lib/password.ts; the fixed salt keeps the output byte-identical between runs. */
function hashPassword(password, salt) {
  const hash = scryptSync(password, salt, 32);
  return `scrypt$${Buffer.from(salt).toString("base64url")}$${hash.toString("base64url")}`;
}

/** mulberry32: a tiny fixed-seed PRNG, so "noise" in the curves is reproducible. */
function prng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

function parseDay(day) {
  return new Date(`${day}T00:00:00.000Z`);
}

function addDays(day, days) {
  const date = parseDay(day);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Weekly progress readings from the start date until launch (or the reference now), ending at `progress`. */
function progressHistory(project) {
  const end = project.launchedAt ?? REFERENCE_NOW.slice(0, 10);
  const dates = [];
  for (let day = project.startDate; day <= end; day = addDays(day, 7)) dates.push(day);
  if (dates.length === 0) return [];
  const random = prng(hashString(project.id));
  const last = dates.length - 1;
  let previous = 0;
  return dates.map((date, index) => {
    if (index === last) return { date, progress: project.progress };
    if (index === 0) return { date, progress: 0 };
    const t = index / last;
    const target = project.progress * t ** 1.15 + (random() - 0.5) * 6;
    const value = Math.max(previous, Math.min(project.progress, Math.round(target)));
    previous = value;
    return { date, progress: value };
  });
}

const people = [
  { id: "per_maya", name: "Maya Chen", email: "maya@harborly.demo", role: "Head of Product", avatarColor: "blue" },
  { id: "per_leo", name: "Leo Park", email: "leo@harborly.demo", role: "Engineering Lead", avatarColor: "violet" },
  { id: "per_priya", name: "Priya Nair", email: "priya@harborly.demo", role: "Product Designer", avatarColor: "rose" },
  { id: "per_sam", name: "Sam Okafor", email: "sam@harborly.demo", role: "Marketing Lead", avatarColor: "amber" },
  {
    id: "per_elena",
    name: "Elena Rossi",
    email: "elena@harborly.demo",
    role: "Product Manager",
    avatarColor: "emerald",
  },
  { id: "per_diego", name: "Diego Alvarez", email: "diego@harborly.demo", role: "QA Engineer", avatarColor: "cyan" },
  { id: "per_hana", name: "Hana Sato", email: "hana@harborly.demo", role: "Data Analyst", avatarColor: "indigo" },
];

const companies = [
  { id: "cmp_acme", name: "Acme Rockets" },
  { id: "cmp_northwind", name: "Northwind" },
  { id: "cmp_lumen", name: "Lumen Labs" },
  { id: "cmp_bluebird", name: "Bluebird Freight" },
  { id: "cmp_kestrel", name: "Kestrel Health" },
];

/** [label, assigneeId, done] */
function checklist(items) {
  return items.map(([label, assigneeId, done], index) => ({ id: `chk_${index + 1}`, label, done, assigneeId }));
}

/** [label, date, done] */
function milestones(items) {
  return items.map(([label, date, done], index) => ({ id: `mls_${index + 1}`, label, date, done }));
}

const projectSpecs = [
  {
    id: "prj_launch",
    name: "Q3 Launch",
    summary:
      "Ship the Projects board, launch checklist templates and velocity insights to every Acme Rockets workspace.",
    status: "in-progress",
    health: "on-track",
    progress: 68,
    customerId: "cmp_acme",
    ownerId: "per_maya",
    startDate: "2026-07-20",
    dueDate: "2026-09-30",
    launchedAt: null,
    createdAt: "2026-07-20T09:00:00.000Z",
    checklist: checklist([
      ["Finalize launch scope", "per_maya", true],
      ["Write release notes", "per_elena", true],
      ["Design launch assets", "per_priya", true],
      ["Update pricing page", "per_sam", true],
      ["QA sign-off", "per_leo", true],
      ["Load test billing endpoints", "per_diego", false],
      ["Prepare launch email", "per_sam", false],
      ["Go / no-go review", "per_maya", false],
    ]),
    milestones: milestones([
      ["Kickoff", "2026-07-20", true],
      ["Scope locked", "2026-08-07", true],
      ["Beta release", "2026-08-28", true],
      ["Release candidate", "2026-09-18", false],
      ["Launch", "2026-09-30", false],
    ]),
  },
  {
    id: "prj_mobile-onboarding",
    name: "Mobile onboarding",
    summary:
      "Redesign the first-run experience in the Lumen Labs mobile app so new teams reach their first launch plan faster.",
    status: "in-progress",
    health: "on-track",
    progress: 54,
    customerId: "cmp_lumen",
    ownerId: "per_priya",
    startDate: "2026-07-06",
    dueDate: "2026-10-16",
    launchedAt: null,
    createdAt: "2026-07-06T10:15:00.000Z",
    checklist: checklist([
      ["Map the current onboarding funnel", "per_hana", true],
      ["Prototype the new welcome flow", "per_priya", true],
      ["Usability test with 8 teams", "per_priya", true],
      ["Build onboarding checklist UI", "per_leo", false],
      ["Instrument activation events", "per_hana", false],
      ["Localize copy for the EU launch", "per_elena", false],
    ]),
    milestones: milestones([
      ["Kickoff", "2026-07-06", true],
      ["Prototype review", "2026-07-31", true],
      ["Beta", "2026-09-04", true],
      ["Launch", "2026-10-16", false],
    ]),
  },
  {
    id: "prj_android-app-v2",
    name: "Android app v2",
    summary: "Bring the Bluebird Freight driver app to parity with iOS, including offline delivery checklists.",
    status: "in-progress",
    health: "at-risk",
    progress: 46,
    customerId: "cmp_bluebird",
    ownerId: "per_diego",
    startDate: "2026-06-29",
    dueDate: "2026-10-23",
    launchedAt: null,
    createdAt: "2026-06-29T08:40:00.000Z",
    checklist: checklist([
      ["Offline sync spike", "per_leo", true],
      ["Rebuild delivery checklist", "per_priya", true],
      ["Regression suite on 12 devices", "per_diego", false],
      ["Play Store listing", "per_sam", false],
      ["Staged rollout plan", "per_diego", false],
    ]),
    milestones: milestones([
      ["Kickoff", "2026-06-29", true],
      ["Internal alpha", "2026-08-14", true],
      ["Public beta", "2026-09-25", false],
      ["Launch", "2026-10-23", false],
    ]),
  },
  {
    id: "prj_billing-migration",
    name: "Billing migration",
    summary: "Move Northwind subscriptions to the new billing provider without interrupting renewals.",
    status: "in-progress",
    health: "off-track",
    progress: 37,
    customerId: "cmp_northwind",
    ownerId: "per_leo",
    startDate: "2026-06-15",
    dueDate: "2026-10-02",
    launchedAt: null,
    createdAt: "2026-06-15T13:05:00.000Z",
    checklist: checklist([
      ["Audit existing plans", "per_elena", true],
      ["Map invoice fields", "per_leo", true],
      ["Dual-write subscriptions", "per_leo", false],
      ["Reconcile test invoices", "per_diego", false],
      ["Brief the finance team", "per_sam", false],
      ["Cut over renewals", "per_leo", false],
    ]),
    milestones: milestones([
      ["Kickoff", "2026-06-15", true],
      ["Data mapping", "2026-07-10", true],
      ["Dual write", "2026-08-21", false],
      ["Cutover", "2026-10-02", false],
    ]),
  },
  {
    id: "prj_pricing-page-refresh",
    name: "Pricing page refresh",
    summary: "Clearer plan comparisons and annual billing on the Acme Rockets pricing page.",
    status: "review",
    health: "on-track",
    progress: 88,
    customerId: "cmp_acme",
    ownerId: "per_sam",
    startDate: "2026-08-03",
    dueDate: "2026-09-22",
    launchedAt: null,
    createdAt: "2026-08-03T09:30:00.000Z",
    checklist: checklist([
      ["Pricing research", "per_hana", true],
      ["Copy and layout", "per_sam", true],
      ["Design review", "per_priya", true],
      ["A/B test setup", "per_hana", true],
      ["Legal review", "per_elena", false],
    ]),
    milestones: milestones([
      ["Kickoff", "2026-08-03", true],
      ["Design sign-off", "2026-08-21", true],
      ["Review", "2026-09-15", true],
      ["Launch", "2026-09-22", false],
    ]),
  },
  {
    id: "prj_usage-analytics",
    name: "Usage analytics",
    summary: "Self-serve usage dashboards for Kestrel Health admins, with weekly email digests.",
    status: "review",
    health: "at-risk",
    progress: 82,
    customerId: "cmp_kestrel",
    ownerId: "per_hana",
    startDate: "2026-07-13",
    dueDate: "2026-09-25",
    launchedAt: null,
    createdAt: "2026-07-13T11:20:00.000Z",
    checklist: checklist([
      ["Define core metrics", "per_hana", true],
      ["Build the event pipeline", "per_leo", true],
      ["Dashboard UI", "per_priya", true],
      ["Weekly digest email", "per_sam", true],
      ["Compliance review", "per_elena", false],
      ["Performance budget check", "per_diego", false],
    ]),
    milestones: milestones([
      ["Kickoff", "2026-07-13", true],
      ["Pipeline ready", "2026-08-07", true],
      ["Dashboard beta", "2026-08-28", true],
      ["Launch", "2026-09-25", false],
    ]),
  },
  {
    id: "prj_eu-data-residency",
    name: "EU data residency",
    summary: "Host Kestrel Health workspaces in the EU region, with region-pinned backups.",
    status: "planning",
    health: "on-track",
    progress: 12,
    customerId: "cmp_kestrel",
    ownerId: "per_leo",
    startDate: "2026-09-02",
    dueDate: "2026-11-20",
    launchedAt: null,
    createdAt: "2026-09-02T09:20:00.000Z",
    checklist: checklist([
      ["Vendor assessment", "per_leo", true],
      ["Data flow inventory", "per_hana", false],
      ["Security review", "per_diego", false],
      ["Customer communication plan", "per_sam", false],
      ["Migration runbook", "per_leo", false],
    ]),
    milestones: milestones([
      ["Kickoff", "2026-09-02", true],
      ["Architecture review", "2026-09-24", false],
      ["Pilot region", "2026-10-22", false],
      ["Launch", "2026-11-20", false],
    ]),
  },
  {
    id: "prj_partner-api",
    name: "Partner API",
    summary: "Public REST endpoints so Northwind partners can sync launch plans into their own tools.",
    status: "planning",
    health: "on-track",
    progress: 8,
    customerId: "cmp_northwind",
    ownerId: "per_elena",
    startDate: "2026-09-08",
    dueDate: "2026-12-04",
    launchedAt: null,
    createdAt: "2026-09-08T10:05:00.000Z",
    checklist: checklist([
      ["Partner interviews", "per_elena", true],
      ["API design doc", "per_leo", false],
      ["Auth and rate limits", "per_leo", false],
      ["Developer docs", "per_elena", false],
      ["Sandbox environment", "per_diego", false],
    ]),
    milestones: milestones([
      ["Kickoff", "2026-09-08", true],
      ["Design review", "2026-09-29", false],
      ["Private beta", "2026-11-03", false],
      ["Launch", "2026-12-04", false],
    ]),
  },
  {
    id: "prj_holiday-campaign",
    name: "Holiday campaign",
    summary: "Seasonal campaign for Bluebird Freight: landing pages, emails and in-app announcements.",
    status: "planning",
    health: "on-track",
    progress: 5,
    customerId: "cmp_bluebird",
    ownerId: "per_sam",
    startDate: "2026-09-10",
    dueDate: "2026-11-27",
    launchedAt: null,
    createdAt: "2026-09-10T15:30:00.000Z",
    checklist: checklist([
      ["Campaign brief", "per_sam", true],
      ["Creative concepts", "per_priya", false],
      ["Landing page build", "per_leo", false],
      ["Email sequence", "per_sam", false],
      ["Launch day runbook", "per_maya", false],
    ]),
    milestones: milestones([
      ["Kickoff", "2026-09-10", true],
      ["Creative review", "2026-10-09", false],
      ["Assets final", "2026-11-06", false],
      ["Launch", "2026-11-27", false],
    ]),
  },
  {
    id: "prj_projects-board-beta",
    name: "Projects board beta",
    summary: "Beta of the new Projects board, with status columns and health badges.",
    status: "launched",
    health: "on-track",
    progress: 100,
    customerId: "cmp_acme",
    ownerId: "per_elena",
    startDate: "2026-06-01",
    dueDate: "2026-09-05",
    launchedAt: "2026-09-04",
    createdAt: "2026-06-01T09:00:00.000Z",
    checklist: checklist([
      ["Select the beta cohort", "per_elena", true],
      ["Board interactions", "per_leo", true],
      ["Health badge logic", "per_hana", true],
      ["Beta feedback survey", "per_priya", true],
      ["Launch announcement", "per_sam", true],
    ]),
    milestones: milestones([
      ["Kickoff", "2026-06-01", true],
      ["Alpha", "2026-07-10", true],
      ["Beta", "2026-08-07", true],
      ["Launch", "2026-09-04", true],
    ]),
  },
  {
    id: "prj_help-center-revamp",
    name: "Help center revamp",
    summary: "A searchable help center for Lumen Labs, with guided setup articles.",
    status: "launched",
    health: "on-track",
    progress: 100,
    customerId: "cmp_lumen",
    ownerId: "per_priya",
    startDate: "2026-05-11",
    dueDate: "2026-08-14",
    launchedAt: "2026-08-21",
    createdAt: "2026-05-11T14:00:00.000Z",
    checklist: checklist([
      ["Content audit", "per_elena", true],
      ["Information architecture", "per_priya", true],
      ["Search tuning", "per_leo", true],
      ["Article migration", "per_hana", true],
    ]),
    milestones: milestones([
      ["Kickoff", "2026-05-11", true],
      ["New navigation", "2026-06-19", true],
      ["Content migrated", "2026-08-07", true],
      ["Launch", "2026-08-21", true],
    ]),
  },
  {
    id: "prj_spring-launch",
    name: "Spring Launch",
    summary: "The spring release: timeline milestones, dark mode and faster boards.",
    status: "launched",
    health: "on-track",
    progress: 100,
    customerId: "cmp_acme",
    ownerId: "per_maya",
    startDate: "2026-02-02",
    dueDate: "2026-05-29",
    launchedAt: "2026-05-28",
    createdAt: "2026-02-02T09:00:00.000Z",
    checklist: checklist([
      ["Finalize scope", "per_maya", true],
      ["Dark mode polish", "per_priya", true],
      ["Board performance", "per_leo", true],
      ["Release notes", "per_elena", true],
      ["Launch webinar", "per_sam", true],
    ]),
    milestones: milestones([
      ["Kickoff", "2026-02-02", true],
      ["Scope locked", "2026-02-27", true],
      ["Beta", "2026-04-24", true],
      ["Launch", "2026-05-28", true],
    ]),
  },
];

const projects = projectSpecs.map((spec) => ({ ...spec, progressHistory: progressHistory(spec) }));

/** [type, actorId, projectId, detail, at] — newest first. */
const activity = [
  ["completed_item", "per_leo", "prj_launch", "QA sign-off", "2026-09-15T08:24:00.000Z"],
  ["moved_project", "per_sam", "prj_pricing-page-refresh", "Review", "2026-09-15T07:10:00.000Z"],
  ["commented", "per_hana", "prj_usage-analytics", null, "2026-09-15T05:45:00.000Z"],
  ["health_changed", "per_diego", "prj_android-app-v2", "At risk", "2026-09-14T16:20:00.000Z"],
  ["completed_item", "per_priya", "prj_mobile-onboarding", "Usability test with 8 teams", "2026-09-14T13:05:00.000Z"],
  ["completed_item", "per_sam", "prj_launch", "Update pricing page", "2026-09-13T11:00:00.000Z"],
  ["health_changed", "per_leo", "prj_billing-migration", "Off track", "2026-09-12T09:40:00.000Z"],
  ["commented", "per_elena", "prj_partner-api", null, "2026-09-11T14:15:00.000Z"],
  ["created_project", "per_sam", "prj_holiday-campaign", null, "2026-09-10T15:30:00.000Z"],
  ["created_project", "per_elena", "prj_partner-api", null, "2026-09-08T10:05:00.000Z"],
  ["launched_project", "per_elena", "prj_projects-board-beta", null, "2026-09-04T16:00:00.000Z"],
  ["milestone_reached", "per_priya", "prj_mobile-onboarding", "Beta", "2026-09-04T12:30:00.000Z"],
  ["completed_item", "per_elena", "prj_launch", "Write release notes", "2026-09-03T15:45:00.000Z"],
  ["created_project", "per_leo", "prj_eu-data-residency", null, "2026-09-02T09:20:00.000Z"],
  ["moved_project", "per_hana", "prj_usage-analytics", "Review", "2026-09-01T17:10:00.000Z"],
].map(([type, actorId, projectId, detail, at], index, all) => ({
  id: `act_${String(all.length - index).padStart(3, "0")}`,
  type,
  actorId,
  projectId,
  detail,
  at,
}));

const velocityWeeks = [
  ["2026-06-22", 24, 26],
  ["2026-06-29", 21, 26],
  ["2026-07-06", 27, 28],
  ["2026-07-13", 29, 30],
  ["2026-07-20", 26, 30],
  ["2026-07-27", 31, 32],
  ["2026-08-03", 34, 32],
  ["2026-08-10", 30, 34],
  ["2026-08-17", 33, 34],
  ["2026-08-24", 36, 36],
  ["2026-08-31", 35, 36],
  ["2026-09-07", 38, 38],
];

const db = {
  version: 1,
  meta: { source: "seed", referenceNow: REFERENCE_NOW },
  workspace: { id: "wsp_acme", name: "Acme Rockets", plan: "Team" },
  users: [
    {
      id: "usr_demo",
      email: "demo@harborly.demo",
      passwordHash: hashPassword("harborly-demo", "harborly-fixture-salt"),
      personId: "per_maya",
      profileEmail: "maya.chen@acme-rockets.example",
    },
  ],
  people,
  companies,
  projects,
  activity,
  velocity: velocityWeeks.map(([weekStart, completed, committed]) => ({ weekStart, completed, committed })),
  // Average days per stage; they sum to the 104-day average kickoff-to-launch of the launched projects above.
  cycleTimes: [
    { stage: "Planning", days: 18.5 },
    { stage: "In progress", days: 61 },
    { stage: "Review", days: 17.5 },
    { stage: "Launch", days: 7 },
  ],
};

const target = process.env.HARBORLY_DB_PATH ?? path.join(process.cwd(), ".data", "db.json");
await mkdir(path.dirname(target), { recursive: true });
const temp = `${target}.${process.pid}.tmp`;
await writeFile(temp, `${JSON.stringify(db, null, 2)}\n`, "utf8");
await rename(temp, target);

console.log(
  `Seeded ${path.relative(process.cwd(), target) || target}: ${projects.length} projects, ${people.length} people, ` +
    `${activity.length} activity items (reference now ${REFERENCE_NOW}). Login: demo@harborly.demo`,
);
