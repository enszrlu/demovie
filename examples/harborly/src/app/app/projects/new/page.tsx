import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { BoardSummary } from "../../_components/board-summary";
import { ProjectsBoard } from "../../_components/projects-board";
import { NewProjectDialog } from "./new-project-dialog";

export const metadata: Metadata = { title: "New project · Harborly" };

export default async function NewProjectPage() {
  const { db, person } = await requireUser();
  return (
    <>
      <div inert className="space-y-5">
        <BoardSummary db={db} />
        <ProjectsBoard db={db} />
      </div>
      <NewProjectDialog
        companies={db.companies.map(({ id, name }) => ({ id, name }))}
        people={db.people.map(({ id, name }) => ({ id, name }))}
        defaultOwnerId={person.id}
        workspaceName={db.workspace.name}
      />
    </>
  );
}
