import type { Metadata } from "next";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { formatLongDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Changelog · Harborly",
  description: "New features and improvements to Harborly.",
};

interface Release {
  date: string;
  version: string;
  title: string;
  kind: "New" | "Improved";
  summary: string;
  highlights: string[];
}

const RELEASES: Release[] = [
  {
    date: "2026-09-09",
    version: "2.8",
    title: "Velocity insights",
    kind: "New",
    summary:
      "See how much your team ships every week. Velocity insights chart completed points against what you committed, so planning starts from real numbers.",
    highlights: [
      "A weekly velocity chart on the dashboard",
      "A 4-week rolling average with its trend",
      "Cycle time by stage in Reports",
    ],
  },
  {
    date: "2026-08-19",
    version: "2.7",
    title: "Launch checklist templates",
    kind: "New",
    summary:
      "Start every launch with QA, docs and announcement tasks already in place. New projects come with a five-step launch checklist you can adapt.",
    highlights: [
      "A default five-step launch checklist",
      "An owner for every item",
      "Done items stay visible, struck through",
    ],
  },
  {
    date: "2026-07-29",
    version: "2.6",
    title: "Team workload",
    kind: "New",
    summary: "The Team page now shows who is working on what, with a workload bar for every teammate.",
    highlights: [
      "Active projects per person",
      "Open checklist items count toward workload",
      "Spot overloaded teammates early",
    ],
  },
  {
    date: "2026-07-08",
    version: "2.5",
    title: "Projects board",
    kind: "Improved",
    summary:
      "The board groups projects by stage, from Planning through In progress and Review to Launched, with health and progress on every card.",
    highlights: [
      "Column counts at a glance",
      "On track, At risk and Off track badges",
      "Due dates and owners on each card",
    ],
  },
  {
    date: "2026-06-17",
    version: "2.4",
    title: "Dark mode",
    kind: "New",
    summary: "Harborly now follows your system theme. Switch between light, dark and system any time from Settings.",
    highlights: ["Matches your operating system by default", "Charts and badges tuned for both themes"],
  },
  {
    date: "2026-05-27",
    version: "2.3",
    title: "Timeline milestones",
    kind: "Improved",
    summary: "Add milestones to any project and follow them on a timeline next to the launch checklist.",
    highlights: ["Done, next and upcoming states", "Milestones scale to your launch date"],
  },
];

const KIND_VARIANT: Record<Release["kind"], BadgeVariant> = { New: "info", Improved: "neutral" };

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-20 pb-24 sm:px-6 lg:px-8">
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-primary">Changelog</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">What’s new in Harborly</h1>
        <p className="mt-4 text-lg text-pretty text-muted-foreground">
          New features and improvements, shipped every few weeks.
        </p>
      </header>

      <ol className="mt-16 space-y-14">
        {RELEASES.map((release) => (
          <li key={release.version}>
            <article className="grid gap-4 md:grid-cols-[180px_1fr] md:gap-10">
              <div className="flex items-center gap-3 md:block md:pt-1">
                <time dateTime={release.date} className="text-sm font-medium text-foreground">
                  {formatLongDate(release.date)}
                </time>
                <p className="text-sm text-muted-foreground md:mt-1">Version {release.version}</p>
              </div>
              <div className="border-border md:border-l md:pl-10">
                <Badge variant={KIND_VARIANT[release.kind]}>{release.kind}</Badge>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">{release.title}</h2>
                <p className="mt-3 leading-7 text-pretty text-muted-foreground">{release.summary}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {release.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-3">
                      <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}
