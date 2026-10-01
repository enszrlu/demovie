import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing · Harborly",
  description: "Simple pricing for launch teams of every size.",
};

const TIERS = [
  {
    name: "Starter",
    price: "$0",
    cadence: "free forever",
    description: "For small teams planning their first launches.",
    cta: "Start for free",
    featured: false,
    features: ["Up to 5 members", "3 active projects", "Projects board", "Launch checklists", "Community support"],
  },
  {
    name: "Team",
    price: "$12",
    cadence: "per user / month",
    description: "For product teams that ship every month.",
    cta: "Start free trial",
    featured: true,
    features: [
      "Unlimited projects",
      "Timelines and milestones",
      "Velocity insights",
      "Checklist templates",
      "Slack and email reminders",
      "Priority email support",
    ],
  },
  {
    name: "Business",
    price: "$24",
    cadence: "per user / month",
    description: "For organizations running many launches at once.",
    cta: "Contact sales",
    featured: false,
    features: [
      "Everything in Team",
      "Cycle time and workload reports",
      "SAML single sign-on",
      "Audit log",
      "EU data residency",
      "Dedicated success manager",
    ],
  },
];

const FAQ = [
  {
    question: "Is there a free trial?",
    answer:
      "Yes. Every Team and Business plan starts with a 14-day free trial, and you don't need a credit card to begin.",
  },
  {
    question: "Who counts as a user?",
    answer: "Anyone who can edit projects. Viewers who only follow launches and read reports are always free.",
  },
  {
    question: "Can we switch plans later?",
    answer: "Any time. Upgrades apply immediately; downgrades take effect at the end of your billing period.",
  },
  {
    question: "Do you offer annual billing?",
    answer: "Yes. Paying annually saves two months on Team and Business, and includes invoicing.",
  },
];

export default function PricingPage() {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-grid [mask-image:radial-gradient(ellipse_60%_80%_at_50%_0%,black,transparent)]"
      />
      <section className="relative mx-auto max-w-6xl px-4 pt-20 pb-16 text-center sm:px-6 lg:px-8">
        <p className="text-sm font-medium text-primary">Pricing</p>
        <h1 className="mx-auto mt-2 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Simple pricing for every launch team
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
          Start free, then upgrade when your team needs more. Every plan includes unlimited viewers.
        </p>
      </section>

      <section aria-label="Plans" className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        <ul className="grid gap-6 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <li
              key={tier.name}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-8 shadow-[0_1px_2px_0_rgb(15_23_42/0.04)] dark:shadow-none",
                tier.featured ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary" : "border-border",
              )}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">{tier.name}</h2>
                {tier.featured ? <Badge variant="info">Most popular</Badge> : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground lg:min-h-10">{tier.description}</p>
              <p className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight">{tier.price}</span>
                <span className="text-sm text-muted-foreground">{tier.cadence}</span>
              </p>
              <Link
                href="/login"
                className={buttonVariants({
                  variant: tier.featured ? "default" : "outline",
                  className: "mt-6 w-full",
                })}
              >
                {tier.cta}
              </Link>
              <ul className="mt-8 space-y-3 text-sm">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="faq-heading" className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <h2 id="faq-heading" className="text-2xl font-semibold tracking-tight">
            Frequently asked questions
          </h2>
          <dl className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-2">
            {FAQ.map((item) => (
              <div key={item.question}>
                <dt className="text-base font-medium">{item.question}</dt>
                <dd className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}
