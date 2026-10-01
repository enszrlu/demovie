// Formatting shared by server and client components. Absolute dates always use en-US in UTC so the
// server render and the first client render produce identical text.

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Parses ISO timestamps and date-only strings (treated as UTC midnight). */
export function parseDate(value: string): Date {
  return new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
}

/** "Sep 30" */
export function formatShortDate(value: string): string {
  return shortDate.format(parseDate(value));
}

/** "Sep 30, 2026" */
export function formatLongDate(value: string): string {
  return longDate.format(parseDate(value));
}

/** "2h ago", "3 days ago"; future timestamps read "just now". */
export function formatRelative(value: string, nowMs: number): string {
  const seconds = Math.round((nowMs - parseDate(value).getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return formatShortDate(value);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase() || "?";
}

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateOnly: string, days: number): string {
  const date = parseDate(dateOnly);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateOnly(date);
}

export function formatNumber(value: number, fractionDigits = 0): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}
