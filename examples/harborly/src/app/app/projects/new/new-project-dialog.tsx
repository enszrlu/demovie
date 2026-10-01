"use client";

import { CircleAlert, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPanel,
  DialogPositioner,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { type CreateProjectState, createProject } from "./actions";

const INITIAL_STATE: CreateProjectState = { error: null, values: null };

export interface Option {
  id: string;
  name: string;
}

export function NewProjectDialog({
  companies,
  people,
  defaultOwnerId,
  workspaceName,
}: {
  companies: Option[];
  people: Option[];
  defaultOwnerId: string;
  workspaceName: string;
}) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(createProject, INITIAL_STATE);

  useEffect(() => {
    nameRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.push("/app/projects");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <>
      <DialogOverlay className="motion-safe:animate-fade-in" />
      <DialogPositioner
        onClick={(event) => {
          if (event.target === event.currentTarget) router.push("/app/projects");
        }}
      >
        <DialogPanel labelledBy="new-project-title" className="motion-safe:animate-dialog-in">
          <form
            action={formAction}
            onSubmit={(event) => {
              // Dispatching ourselves skips React's automatic form reset, so a validation error never
              // wipes what was typed next. Before hydration, the plain form action still works.
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              startTransition(() => formAction(data));
            }}
          >
            <DialogHeader>
              <div className="space-y-1">
                <DialogTitle id="new-project-title">New project</DialogTitle>
                <DialogDescription>Start a launch plan with a checklist, milestones and an owner.</DialogDescription>
              </div>
              <Link
                href="/app/projects"
                aria-label="Close"
                className={buttonVariants({
                  variant: "ghost",
                  size: "icon",
                  className: "-mt-1 -mr-2 size-8 text-muted-foreground",
                })}
              >
                <X aria-hidden="true" className="size-4" />
              </Link>
            </DialogHeader>

            <div className="grid gap-5 px-6 py-6">
              <div className="grid gap-2">
                <Label htmlFor="project-name">Project name</Label>
                <Input
                  ref={nameRef}
                  id="project-name"
                  name="name"
                  required
                  maxLength={80}
                  autoComplete="off"
                  placeholder="e.g. Winter launch"
                  defaultValue={state.values?.name ?? ""}
                  aria-invalid={state.error ? true : undefined}
                  aria-describedby={state.error ? "new-project-error" : undefined}
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="project-customer">Customer</Label>
                  <Select
                    id="project-customer"
                    name="customerId"
                    defaultValue={state.values?.customerId ?? companies[0]?.id ?? ""}
                  >
                    {companies.length === 0 ? <option value="">{workspaceName}</option> : null}
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="project-owner">Owner</Label>
                  <Select id="project-owner" name="ownerId" defaultValue={state.values?.ownerId ?? defaultOwnerId}>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="project-launch-date">Launch date</Label>
                <Input
                  id="project-launch-date"
                  name="launchDate"
                  type="date"
                  defaultValue={state.values?.launchDate ?? ""}
                  aria-describedby="project-launch-date-hint"
                />
                <p id="project-launch-date-hint" className="text-xs text-muted-foreground">
                  Optional. Milestones are spaced out to this date.
                </p>
              </div>
              {state.error ? (
                <p
                  id="new-project-error"
                  role="alert"
                  className="flex items-center gap-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                >
                  <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
                  {state.error}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Link href="/app/projects" className={buttonVariants({ variant: "outline" })}>
                Cancel
              </Link>
              <Button type="submit" disabled={pending}>
                {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
                Create project
              </Button>
            </DialogFooter>
          </form>
        </DialogPanel>
      </DialogPositioner>
    </>
  );
}
