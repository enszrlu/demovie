import { cn } from "@/lib/utils";

export const CUSTOMER_NAMES = [
  "Acme Rockets",
  "Northwind",
  "Lumen Labs",
  "Bluebird Freight",
  "Kestrel Health",
] as const;
export type CustomerName = (typeof CUSTOMER_NAMES)[number];

function GlyphShapes({ name }: { name: CustomerName }) {
  switch (name) {
    case "Acme Rockets":
      return (
        <>
          <path d="M12 2.5c2.9 2.2 4.4 5.5 4.4 9.8v3.2H7.6v-3.2c0-4.3 1.5-7.6 4.4-9.8Z" />
          <path d="M7.6 12.8 5 15.6v3.1l2.6-1.3M16.4 12.8l2.6 2.8v3.1l-2.6-1.3M10.5 19.5h3" />
          <circle cx="12" cy="9.5" r="1.6" />
        </>
      );
    case "Northwind":
      return <path d="M12 2.5 14.4 9.6 21.5 12l-7.1 2.4L12 21.5l-2.4-7.1L2.5 12l7.1-2.4Z" />;
    case "Lumen Labs":
      return (
        <>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
        </>
      );
    case "Bluebird Freight":
      return (
        <>
          <path d="M3 14.5 12 7l9 7.5" />
          <path d="M6.5 18.5 12 14l5.5 4.5" />
        </>
      );
    case "Kestrel Health":
      return (
        <>
          <rect x="3" y="3" width="18" height="18" rx="6" />
          <path d="M12 8v8M8 12h8" />
        </>
      );
  }
}

const TEXT_STYLE: Record<CustomerName, string> = {
  "Acme Rockets": "text-[17px] font-semibold tracking-tight",
  Northwind: "text-[13px] font-semibold uppercase tracking-[0.22em]",
  "Lumen Labs": "text-[17px] font-normal tracking-tight",
  "Bluebird Freight": "text-[16px] font-bold tracking-tight",
  "Kestrel Health": "text-[16px] font-medium lowercase tracking-tight",
};

/** A fictional customer's wordmark: a simple glyph plus styled text. */
export function CustomerWordmark({ name, className }: { name: CustomerName; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap", className)}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-5 shrink-0"
      >
        <GlyphShapes name={name} />
      </svg>
      <span className={TEXT_STYLE[name]}>{name}</span>
    </span>
  );
}
