"use client";

import { Cookie } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const CONSENT_KEY = "harborly-cookie-consent";

/** Marketing-only consent banner. demovie hides it with `demo.hide: [".cookie-banner"]`. */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(!window.localStorage.getItem(CONSENT_KEY));
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = (choice: "accepted" | "declined") => {
    try {
      window.localStorage.setItem(CONSENT_KEY, choice);
    } catch {
      // Without storage the banner simply comes back on the next visit.
    }
    setVisible(false);
  };

  return (
    <section
      aria-label="Cookie consent"
      className="cookie-banner fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-xl flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg shadow-slate-950/10 sm:flex-row sm:items-center sm:gap-4 motion-safe:animate-slide-up"
    >
      <p className="flex flex-1 items-center gap-2.5 text-sm text-muted-foreground">
        <Cookie aria-hidden="true" className="size-4 shrink-0 text-foreground" />
        We use cookies to improve Harborly.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => dismiss("declined")}>
          Decline
        </Button>
        <Button size="sm" onClick={() => dismiss("accepted")}>
          Accept
        </Button>
      </div>
    </section>
  );
}
