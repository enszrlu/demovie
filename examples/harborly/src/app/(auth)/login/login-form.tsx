"use client";

import { CircleAlert, LoaderCircle } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Posts to /api/session. With JavaScript it signs in via fetch and shows errors inline;
 * without it (or before hydration) the native form post gets a 303 redirect instead.
 */
export function LoginForm({ next, initialError }: { next: string | null; initialError: string | null }) {
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password"), next }),
      });
      const body = (await response.json().catch(() => null)) as { redirectTo?: string; error?: string } | null;
      if (response.ok && body?.redirectTo) {
        window.location.assign(body.redirectTo);
        return;
      }
      setError(body?.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Couldn’t reach Harborly. Check your connection and try again.");
    }
    setPending(false);
  }

  return (
    <form method="post" action="/api/session" onSubmit={onSubmit} className="mt-6 space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
        >
          <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
        Sign in
      </Button>
    </form>
  );
}
