import "server-only";
import { redirect } from "next/navigation";
import { readDb } from "./db";
import { getSession } from "./session";
import type { Db, Person, User } from "./types";

export interface CurrentUser {
  user: User;
  person: Person;
  db: Db;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;
  const db = await readDb();
  const user = db.users.find((candidate) => candidate.id === session.uid);
  if (!user) return null;
  const person = db.people.find((candidate) => candidate.id === user.personId) ?? {
    id: user.personId,
    name: user.email,
    email: user.email,
    role: "Member",
  };
  return { user, person, db };
}

/** Defense in depth behind src/proxy.ts: every /app page and Server Function calls this. */
export async function requireUser(): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  return current;
}
