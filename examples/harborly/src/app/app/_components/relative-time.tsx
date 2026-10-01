"use client";

import { useEffect, useState } from "react";
import { formatLongDate, formatRelative, formatShortDate } from "@/lib/format";

/**
 * Server render shows the absolute date; after mount it switches to "2h ago" computed from Date.now(),
 * so a frozen browser clock (e.g. a capture tool) controls the result.
 */
export function RelativeTime({ value, className }: { value: string; className?: string }) {
  const [relative, setRelative] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setRelative(formatRelative(value, Date.now()));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [value]);

  return (
    <time dateTime={value} title={formatLongDate(value)} className={className} suppressHydrationWarning>
      {relative ?? formatShortDate(value)}
    </time>
  );
}
