import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type CustomerName, CustomerWordmark } from "../_components/customer-wordmark";

export const metadata: Metadata = {
  title: "Customers · Harborly",
  description: "How launch teams plan, ship and measure with Harborly.",
};

interface Story {
  company: CustomerName;
  quote: string;
  person: string;
  title: string;
  metric: string;
  metricLabel: string;
  tone: string;
}

const FEATURED: Story = {
  company: "Acme Rockets",
  quote:
    "We used to run launches out of a spreadsheet and a lot of hallway questions. With Harborly every launch has one board, one checklist and one owner, and we ship more of them on time.",
  person: "Maya Chen",
  title: "Head of Product, Acme Rockets",
  metric: "2×",
  metricLabel: "more launches per quarter",
  tone: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200",
};

const STORIES: Story[] = [
  {
    company: "Northwind",
    quote: "Harborly replaced three spreadsheets and a weekly status meeting. The board is the status meeting now.",
    person: "Jonas Weber",
    title: "VP Engineering",
    metric: "−40%",
    metricLabel: "time in status meetings",
    tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200",
  },
  {
    company: "Lumen Labs",
    quote: "Checklist templates mean every launch gets the same QA and docs pass, no matter who runs it.",
    person: "Aisha Bello",
    title: "Director of Product Operations",
    metric: "0",
    metricLabel: "launches without a QA sign-off",
    tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  },
  {
    company: "Bluebird Freight",
    quote: "Velocity insights showed us where work was waiting. Cycle time dropped within a quarter.",
    person: "Tom Lindqvist",
    title: "Head of Mobile",
    metric: "−6 days",
    metricLabel: "average cycle time",
    tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  },
  {
    company: "Kestrel Health",
    quote: "Our compliance reviews finally have an owner and a date on the timeline, so launches stopped slipping.",
    person: "Rosa Martin",
    title: "Delivery Lead",
    metric: "94%",
    metricLabel: "of launches on time",
    tone: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
  },
];

function Person({ story }: { story: Story }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={cn("inline-flex size-9 items-center justify-center rounded-full text-xs font-semibold", story.tone)}
      >
        {initials(story.person)}
      </span>
      <div className="text-sm">
        <p className="font-medium">{story.person}</p>
        <p className="text-muted-foreground">{story.title}</p>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-20 pb-24 sm:px-6 lg:px-8">
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-primary">Customers</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Launch teams ship with Harborly
        </h1>
        <p className="mt-4 text-lg text-pretty text-muted-foreground">
          From rocket software to freight apps, teams use Harborly to plan launches, keep checklists honest and measure
          what they ship.
        </p>
      </header>

      <section aria-label={`${FEATURED.company} story`} className="mt-14">
        <figure className="grid overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[1.6fr_1fr]">
          <div className="p-8 sm:p-10">
            <CustomerWordmark name={FEATURED.company} className="text-foreground/80" />
            <blockquote className="mt-6 text-xl font-medium leading-relaxed tracking-tight text-balance sm:text-2xl">
              “{FEATURED.quote}”
            </blockquote>
            <figcaption className="mt-8">
              <Person story={FEATURED} />
            </figcaption>
          </div>
          <div className="relative flex flex-col justify-center gap-8 border-t border-border bg-muted/40 p-8 sm:p-10 lg:border-t-0 lg:border-l">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
            <div className="relative">
              <p className="text-5xl font-semibold tracking-tight text-primary">{FEATURED.metric}</p>
              <p className="mt-2 text-sm text-muted-foreground">{FEATURED.metricLabel}</p>
            </div>
            <div className="relative">
              <p className="text-5xl font-semibold tracking-tight">12</p>
              <p className="mt-2 text-sm text-muted-foreground">launch plans tracked in one workspace</p>
            </div>
          </div>
        </figure>
      </section>

      <section aria-label="More customer stories" className="mt-6">
        <ul className="grid gap-6 md:grid-cols-2">
          {STORIES.map((story) => (
            <li key={story.company}>
              <figure className="flex h-full flex-col rounded-2xl border border-border bg-card p-8">
                <div className="flex items-start justify-between gap-4">
                  <CustomerWordmark name={story.company} className="text-foreground/80" />
                  <div className="text-right">
                    <p className="text-2xl font-semibold tracking-tight">{story.metric}</p>
                    <p className="text-xs text-muted-foreground">{story.metricLabel}</p>
                  </div>
                </div>
                <blockquote className="mt-6 flex-1 leading-7 text-pretty">“{story.quote}”</blockquote>
                <figcaption className="mt-6">
                  <Person story={story} />
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-20 flex flex-col items-center gap-4 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Plan your next launch with Harborly</h2>
        <Link href="/login" className={buttonVariants({ size: "lg" })}>
          Start free trial
        </Link>
      </section>
    </div>
  );
}
