import { ArrowRight, ChartColumnIncreasing, ListChecks, SquareKanban, Users } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { CUSTOMER_NAMES, CustomerWordmark } from "./_components/customer-wordmark";
import { ProductPanel } from "./_components/product-panel";

const FEATURES = [
  {
    title: "Projects board",
    description: "See every launch at a glance, from planning to launched, with health and progress on every card.",
    icon: SquareKanban,
  },
  {
    title: "Launch checklist",
    description: "Reusable checklists keep QA, docs and announcements moving, with a clear owner for every item.",
    icon: ListChecks,
  },
  {
    title: "Velocity insights",
    description: "Weekly velocity and cycle time show how much your team ships, and where work waits.",
    icon: ChartColumnIncreasing,
  },
  {
    title: "Team workload",
    description: "Spot overloaded teammates early and rebalance work before a deadline slips.",
    icon: Users,
  },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[-12rem] left-1/2 h-[32rem] w-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl sm:w-[56rem] dark:bg-primary/20"
        />
        <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-14 text-center sm:px-6 lg:px-8 lg:pt-24">
          <Link
            href="/changelog"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 py-1 pr-3 pl-1 text-[13px] text-muted-foreground shadow-xs transition-colors hover:text-foreground"
          >
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">New</span>
            Velocity insights are here
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl sm:leading-[1.05]">
            Plan, ship and measure every launch.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-pretty text-muted-foreground">
            Harborly brings launch plans, checklists and team velocity into one calm workspace, so every release lands
            on time.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}>
              Start free trial
            </Link>
            <Link
              href="/pricing"
              className={buttonVariants({ variant: "outline", size: "lg", className: "w-full sm:w-auto" })}
            >
              Book a demo
            </Link>
          </div>
          <p className="mt-4 text-[13px] text-muted-foreground">Free for teams of up to 5 · No credit card required</p>
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
          <ProductPanel />
        </div>
      </section>

      <section aria-labelledby="customers-heading" className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 id="customers-heading" className="text-center text-sm font-medium text-muted-foreground">
            Launch teams at fast-moving companies plan with Harborly
          </h2>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6 text-foreground/60">
            {CUSTOMER_NAMES.map((name) => (
              <li key={name}>
                <CustomerWordmark name={name} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="features-heading" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-primary">Built for launch teams</p>
          <h2 id="features-heading" className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Everything a launch needs, in one place
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            From the first kickoff to the go / no-go call, Harborly keeps product, engineering and marketing on the same
            plan.
          </p>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <li
              key={feature.title}
              className="rounded-xl border border-border bg-card p-6 shadow-[0_1px_2px_0_rgb(15_23_42/0.04)] dark:shadow-none"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <feature.icon aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-5 text-base font-semibold tracking-tight">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Customer quote" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        <figure className="mx-auto max-w-3xl text-center">
          <blockquote className="text-2xl font-medium tracking-tight text-balance sm:text-[28px] sm:leading-snug">
            “Harborly replaced three spreadsheets and a weekly status meeting. Every launch now runs on one plan that
            the whole team trusts.”
          </blockquote>
          <figcaption className="mt-6 flex items-center justify-center gap-3 text-sm">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
              JW
            </span>
            <span className="text-left">
              <span className="block font-medium">Jonas Weber</span>
              <span className="block text-muted-foreground">VP Engineering, Northwind</span>
            </span>
          </figcaption>
        </figure>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-14 text-center sm:px-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
          />
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Ready for your next launch?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground">
              Set up your first launch plan in minutes. Bring your team, your checklist and your deadline.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/login" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}>
                Start free trial
              </Link>
              <Link
                href="/pricing"
                className={buttonVariants({ variant: "outline", size: "lg", className: "w-full sm:w-auto" })}
              >
                See pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
