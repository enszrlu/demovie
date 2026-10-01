import { ChartColumn, Check, LayoutDashboard, Plus, Settings, SquareKanban, TrendingUp, Users } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

type Health = "on-track" | "at-risk" | "off-track";

const OWNER_TONES = {
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/25 dark:text-blue-200",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/25 dark:text-violet-200",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/25 dark:text-rose-200",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-200",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-200",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-200",
} as const;

interface MiniCard {
  name: string;
  customer: string;
  health: Health;
  progress: number;
  due: string;
  owner: string;
  ownerTone: keyof typeof OWNER_TONES;
}

const COLUMNS: { title: string; cards: MiniCard[] }[] = [
  {
    title: "Planning",
    cards: [
      {
        name: "Partner API",
        customer: "Northwind",
        health: "on-track",
        progress: 8,
        due: "Due Dec 4",
        owner: "ER",
        ownerTone: "emerald",
      },
      {
        name: "Holiday campaign",
        customer: "Bluebird Freight",
        health: "on-track",
        progress: 5,
        due: "Due Nov 27",
        owner: "SO",
        ownerTone: "amber",
      },
    ],
  },
  {
    title: "In progress",
    cards: [
      {
        name: "Q3 Launch",
        customer: "Acme Rockets",
        health: "on-track",
        progress: 68,
        due: "Due Sep 30",
        owner: "MC",
        ownerTone: "blue",
      },
      {
        name: "Mobile onboarding",
        customer: "Lumen Labs",
        health: "on-track",
        progress: 54,
        due: "Due Oct 16",
        owner: "PN",
        ownerTone: "rose",
      },
      {
        name: "Billing migration",
        customer: "Northwind",
        health: "off-track",
        progress: 37,
        due: "Due Oct 2",
        owner: "LP",
        ownerTone: "violet",
      },
    ],
  },
  {
    title: "Review",
    cards: [
      {
        name: "Pricing page refresh",
        customer: "Acme Rockets",
        health: "on-track",
        progress: 88,
        due: "Due Sep 22",
        owner: "SO",
        ownerTone: "amber",
      },
      {
        name: "Usage analytics",
        customer: "Kestrel Health",
        health: "at-risk",
        progress: 82,
        due: "Due Sep 25",
        owner: "HS",
        ownerTone: "indigo",
      },
    ],
  },
  {
    title: "Launched",
    cards: [
      {
        name: "Projects board beta",
        customer: "Acme Rockets",
        health: "on-track",
        progress: 100,
        due: "Launched Sep 4",
        owner: "ER",
        ownerTone: "emerald",
      },
      {
        name: "Help center revamp",
        customer: "Lumen Labs",
        health: "on-track",
        progress: 100,
        due: "Launched Aug 21",
        owner: "PN",
        ownerTone: "rose",
      },
    ],
  },
];

const HEALTH: Record<Health, { label: string; className: string }> = {
  "on-track": {
    label: "On track",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  "at-risk": { label: "At risk", className: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300" },
  "off-track": { label: "Off track", className: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" },
};

const VELOCITY = [24, 21, 27, 29, 26, 31, 34, 30, 33, 36, 35, 38];

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Projects", icon: SquareKanban, active: true },
  { label: "Team", icon: Users },
  { label: "Reports", icon: ChartColumn },
  { label: "Settings", icon: Settings },
];

function Card({ card }: { card: MiniCard }) {
  const health = HEALTH[card.health];
  return (
    <div className="rounded-lg border border-border bg-card p-2.5 text-left shadow-[0_1px_2px_rgb(15_23_42/0.05)]">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10px] text-muted-foreground">{card.customer}</span>
        <span className={cn("shrink-0 rounded-full px-1.5 py-px text-[9px] font-medium", health.className)}>
          {health.label}
        </span>
      </div>
      <p className="mt-1 truncate text-[12px] font-medium text-foreground">{card.name}</p>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 rounded-full bg-muted dark:bg-white/10">
          <div
            className={cn("h-1 rounded-full", card.progress === 100 ? "bg-emerald-500" : "bg-primary")}
            style={{ width: `${card.progress}%` }}
          />
        </div>
        <span className="text-[9px] tabular-nums text-muted-foreground">{card.progress}%</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{card.due}</span>
        <span
          className={cn(
            "inline-flex size-4 items-center justify-center rounded-full text-[7px] font-semibold",
            OWNER_TONES[card.ownerTone],
          )}
        >
          {card.owner}
        </span>
      </div>
    </div>
  );
}

/** The hero illustration: a stylized, static rendering of the Harborly board in plain HTML/CSS. */
export function ProductPanel() {
  return (
    <figure className="relative mx-auto max-w-5xl">
      <figcaption className="sr-only">Preview of the Harborly projects board</figcaption>
      <div aria-hidden="true" className="select-none">
        <div className="overflow-hidden rounded-xl border border-border bg-background shadow-2xl shadow-slate-950/10 ring-1 ring-slate-950/5 dark:shadow-black/40 dark:ring-white/5">
          <div className="flex h-10 items-center gap-1.5 border-b border-border bg-muted/50 px-4">
            <span className="size-2.5 rounded-full bg-slate-300 dark:bg-white/15" />
            <span className="size-2.5 rounded-full bg-slate-300 dark:bg-white/15" />
            <span className="size-2.5 rounded-full bg-slate-300 dark:bg-white/15" />
            <span className="mx-auto rounded-md border border-border bg-background px-3 py-0.5 text-[11px] text-muted-foreground">
              harborly.example/app/projects
            </span>
            <span className="w-10" />
          </div>
          <div className="flex h-[420px]">
            <div className="hidden w-44 shrink-0 flex-col gap-1 border-r border-border bg-sidebar p-3 sm:flex">
              <div className="mb-3 flex items-center gap-2 px-1.5 pt-0.5">
                <LogoMark className="size-5" />
                <span className="text-[13px] font-semibold tracking-tight">Harborly</span>
              </div>
              {NAV.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px]",
                    item.active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                </div>
              ))}
            </div>
            <div className="min-w-0 flex-1 overflow-hidden p-4">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold tracking-tight">Projects</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground">
                  <Plus className="size-3" />
                  New project
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                {COLUMNS.map((column, index) => (
                  <div
                    key={column.title}
                    className={cn("flex flex-col gap-2 rounded-lg bg-muted/60 p-2", index > 1 && "hidden md:flex")}
                  >
                    <div className="flex items-center justify-between px-0.5 text-[11px] font-medium">
                      <span>{column.title}</span>
                      <span className="text-muted-foreground tabular-nums">{column.cards.length}</span>
                    </div>
                    {column.cards.map((card) => (
                      <Card key={card.name} card={card} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute -bottom-10 -left-10 hidden w-60 rounded-xl border border-border bg-card p-4 text-left shadow-xl shadow-slate-950/10 lg:block dark:shadow-black/40">
          <p className="text-[12px] font-semibold">Launch checklist</p>
          <p className="text-[10px] text-muted-foreground">Q3 Launch · 5 of 8 done</p>
          <ul className="mt-3 space-y-2 text-[11px]">
            <li className="flex items-center gap-2 text-muted-foreground line-through">
              <span className="inline-flex size-3.5 items-center justify-center rounded-sm bg-primary text-primary-foreground">
                <Check className="size-2.5" strokeWidth={3} />
              </span>
              QA sign-off
            </li>
            <li className="flex items-center gap-2">
              <span className="size-3.5 rounded-sm border border-input bg-background" />
              Load test billing endpoints
            </li>
            <li className="flex items-center gap-2">
              <span className="size-3.5 rounded-sm border border-input bg-background" />
              Prepare launch email
            </li>
          </ul>
        </div>

        <div className="absolute -right-10 -bottom-12 hidden w-64 rounded-xl border border-border bg-card p-4 text-left shadow-xl shadow-slate-950/10 lg:block dark:shadow-black/40">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold">Velocity</p>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="size-3" />
              +17%
            </span>
          </div>
          <p className="mt-1 text-[20px] font-semibold tracking-tight tabular-nums">
            35.5 <span className="text-[11px] font-normal text-muted-foreground">pts / week</span>
          </p>
          <div className="mt-3 flex h-16 items-end gap-1">
            {VELOCITY.map((value, index) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: static, never reordered
                key={index}
                className={cn("flex-1 rounded-t-sm", index >= VELOCITY.length - 4 ? "bg-primary" : "bg-primary/25")}
                style={{ height: `${(value / 40) * 100}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}
