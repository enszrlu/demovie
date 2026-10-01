"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { writeDb } from "@/lib/db";
import { nextActivityId } from "@/lib/projects";

/** Checks or unchecks one launch-checklist item; checking it also records an activity item. */
export async function toggleChecklistItem(projectId: string, itemId: string, done: boolean): Promise<void> {
  const { db, person } = await requireUser();
  const project = db.projects.find((candidate) => candidate.id === projectId);
  const item = project?.checklist.find((candidate) => candidate.id === itemId);
  if (!project || !item || item.done === done) return;

  item.done = done;
  if (done) {
    db.activity.push({
      id: nextActivityId(db),
      type: "completed_item",
      actorId: person.id,
      projectId,
      detail: item.label,
      at: new Date().toISOString(),
    });
  }
  await writeDb(db);
  revalidatePath("/app", "layout");
}
