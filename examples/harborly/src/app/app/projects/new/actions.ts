"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { writeDb } from "@/lib/db";
import { referenceNow } from "@/lib/metrics";
import { buildNewProject, nextActivityId } from "@/lib/projects";

export interface CreateProjectValues {
  name: string;
  customerId: string;
  ownerId: string;
  launchDate: string;
}

export interface CreateProjectState {
  error: string | null;
  values: CreateProjectValues | null;
}

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Creates a project in the Planning column, records the activity, then opens the new project. */
export async function createProject(_previous: CreateProjectState, formData: FormData): Promise<CreateProjectState> {
  const { db, person } = await requireUser();
  const values: CreateProjectValues = {
    name: field(formData, "name"),
    customerId: field(formData, "customerId"),
    ownerId: field(formData, "ownerId"),
    launchDate: field(formData, "launchDate"),
  };

  if (!values.name) return { error: "Give your project a name.", values };
  if (values.name.length > 80) return { error: "Keep the project name under 80 characters.", values };
  if (values.launchDate && !/^\d{4}-\d{2}-\d{2}$/.test(values.launchDate)) {
    return { error: "Pick a valid launch date, or leave it empty.", values };
  }

  // Seeded demo data pins "now" (db.meta.referenceNow) so new projects fit the demo timeline.
  const now = referenceNow(db);
  const project = buildNewProject({
    db,
    name: values.name,
    customerId: db.companies.some((company) => company.id === values.customerId) ? values.customerId : null,
    ownerId: db.people.some((candidate) => candidate.id === values.ownerId) ? values.ownerId : person.id,
    launchDate: values.launchDate || null,
    now,
  });

  db.projects.push(project);
  db.activity.push({
    id: nextActivityId(db),
    type: "created_project",
    actorId: person.id,
    projectId: project.id,
    detail: null,
    at: now.toISOString(),
  });
  await writeDb(db);

  revalidatePath("/app", "layout");
  redirect(`/app/projects/${project.id}`);
}
