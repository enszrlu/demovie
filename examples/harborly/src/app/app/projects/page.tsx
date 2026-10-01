import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { BoardSummary } from "../_components/board-summary";
import { ProjectsBoard } from "../_components/projects-board";

export const metadata: Metadata = { title: "Projects · Harborly" };

export default async function ProjectsPage() {
  const { db } = await requireUser();
  return (
    <div className="space-y-5">
      <BoardSummary db={db} />
      <ProjectsBoard db={db} />
    </div>
  );
}
