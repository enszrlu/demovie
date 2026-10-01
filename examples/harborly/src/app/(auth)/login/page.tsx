import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Harborly" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next) : null;
  if (await getCurrentUser()) redirect(next ?? "/app");

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-muted/30 px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_50%_50%_at_50%_45%,black,transparent)]"
      />
      <div className="relative w-full max-w-sm">
        <div className="flex justify-center">
          <Logo />
        </div>
        <div className="mt-8 rounded-2xl border border-border bg-card p-8 shadow-xl shadow-slate-950/5 dark:shadow-black/30">
          <h1 className="text-xl font-semibold tracking-tight">Sign in to Harborly</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Welcome back. Enter your details to continue.</p>
          <LoginForm next={next} initialError={params.error === "invalid" ? "Incorrect email or password." : null} />
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to Harborly?{" "}
          <Link href="/pricing" className="font-medium text-foreground hover:underline">
            See plans
          </Link>
        </p>
      </div>
    </main>
  );
}
