"use client";

import { Check } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { AvatarColor, ChecklistItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toggleChecklistItem } from "./actions";

export interface Assignee {
  name: string;
  avatarColor?: AvatarColor;
}

export function ChecklistCard({
  projectId,
  items,
  assignees,
}: {
  projectId: string;
  items: ChecklistItem[];
  assignees: Record<string, Assignee>;
}) {
  const [, startTransition] = useTransition();
  const [optimisticItems, applyOptimistic] = useOptimistic(items, (current, update: { id: string; done: boolean }) =>
    current.map((item) => (item.id === update.id ? { ...item, done: update.done } : item)),
  );
  const doneCount = optimisticItems.filter((item) => item.done).length;

  const toggle = (id: string, done: boolean) => {
    startTransition(async () => {
      applyOptimistic({ id, done });
      await toggleChecklistItem(projectId, id, done);
    });
  };

  return (
    <Card data-testid="project-checklist">
      <CardHeader>
        <div>
          <CardTitle>Launch checklist</CardTitle>
          <CardDescription>
            {doneCount} of {optimisticItems.length} complete
          </CardDescription>
        </div>
        <Progress
          value={doneCount}
          max={Math.max(1, optimisticItems.length)}
          aria-label="Checklist progress"
          className="mt-2 w-28"
        />
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {optimisticItems.map((item) => {
            const assignee = item.assigneeId ? assignees[item.assigneeId] : undefined;
            const inputId = `checklist-${item.id}`;
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 bg-card px-3.5 py-2.5 transition-colors hover:bg-muted/40"
              >
                <span className="relative flex size-4 shrink-0 items-center justify-center">
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={item.done}
                    onChange={(event) => toggle(item.id, event.target.checked)}
                    className="peer absolute inset-0 size-4 cursor-pointer appearance-none rounded-[5px] border border-input bg-background shadow-xs outline-none transition-colors checked:border-primary checked:bg-primary focus-visible:ring-[3px] focus-visible:ring-ring/40 dark:bg-input/20 dark:checked:bg-primary"
                  />
                  <Check
                    aria-hidden="true"
                    strokeWidth={3}
                    className="pointer-events-none relative hidden size-3 text-primary-foreground peer-checked:block"
                  />
                </span>
                <label
                  htmlFor={inputId}
                  className={cn(
                    "flex-1 cursor-pointer text-sm",
                    item.done ? "text-muted-foreground line-through decoration-muted-foreground/60" : "text-foreground",
                  )}
                >
                  {item.label}
                </label>
                {assignee ? (
                  <Avatar
                    name={assignee.name}
                    color={assignee.avatarColor}
                    size="sm"
                    label={`Assigned to ${assignee.name}`}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Unassigned</span>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
