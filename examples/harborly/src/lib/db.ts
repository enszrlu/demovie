import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Db, User } from "./types";

/** The fixture login (fictional): demo@harborly.demo / harborly-demo. Only the scrypt hash is stored. */
const DEMO_USER: User = {
  id: "usr_demo",
  email: "demo@harborly.demo",
  passwordHash: "scrypt$aGFyYm9ybHktZml4dHVyZS1zYWx0$srYRsbKcWUcnGY2mpm6PAs3pTKFfjP9SvUZmI2UnaPE",
  personId: "per_maya",
  profileEmail: "maya.chen@acme-rockets.example",
};

/** What the app sees before `pnpm demo:seed` has run: the workspace and the demo user, nothing else. */
function defaultDb(): Db {
  return {
    version: 1,
    meta: { source: "default", referenceNow: null },
    workspace: { id: "wsp_acme", name: "Acme Rockets", plan: "Team" },
    users: [{ ...DEMO_USER }],
    people: [
      { id: "per_maya", name: "Maya Chen", email: "maya@harborly.demo", role: "Head of Product", avatarColor: "blue" },
    ],
    companies: [],
    projects: [],
    activity: [],
    velocity: [],
    cycleTimes: [],
  };
}

export function dbPath(): string {
  return process.env.HARBORLY_DB_PATH ?? path.join(/* turbopackIgnore: true */ process.cwd(), ".data", "db.json");
}

function normalize(raw: Partial<Db>): Db {
  const base = defaultDb();
  return {
    version: 1,
    meta: { ...base.meta, ...raw.meta },
    workspace: raw.workspace ?? base.workspace,
    users: raw.users?.length ? raw.users : base.users,
    people: raw.people?.length ? raw.people : base.people,
    companies: raw.companies ?? [],
    projects: raw.projects ?? [],
    activity: raw.activity ?? [],
    velocity: raw.velocity ?? [],
    cycleTimes: raw.cycleTimes ?? [],
  };
}

/** Reads the JSON store from disk on every call, so re-seeding while the server runs takes effect immediately. */
export async function readDb(): Promise<Db> {
  const file = dbPath();
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return defaultDb();
    throw error;
  }
  try {
    return normalize(JSON.parse(text) as Partial<Db>);
  } catch {
    throw new Error(`Harborly data file ${file} is not valid JSON. Run \`pnpm demo:seed\` to rewrite it.`);
  }
}

/** Atomic write: a temp file in the same directory, then rename over the target. */
export async function writeDb(db: Db): Promise<void> {
  const file = dbPath();
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, `${JSON.stringify(db, null, 2)}\n`, "utf8");
  await rename(temp, file);
}
