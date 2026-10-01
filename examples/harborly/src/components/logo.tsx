import Link from "next/link";
import { cn } from "@/lib/utils";

/** The Harborly mark: a blue rounded square with two harbor waves. Colors are literal so the SVG stands alone. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("size-7 shrink-0", className)}
    >
      <rect width="32" height="32" rx="8" fill="#2563EB" />
      <path
        d="M7 13.25c1.75 0 2.75-2 4.5-2s2.75 2 4.5 2 2.75-2 4.5-2 2.75 2 4.5 2"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 20.75c1.75 0 2.75-2 4.5-2s2.75 2 4.5 2 2.75-2 4.5-2 2.75 2 4.5 2"
        stroke="#FFFFFF"
        strokeOpacity="0.62"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mark followed by the "Harborly" wordmark, linking home. */
export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-md text-[17px] font-semibold tracking-tight text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
        className,
      )}
    >
      <LogoMark />
      <span>Harborly</span>
    </Link>
  );
}
