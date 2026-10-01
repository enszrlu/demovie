"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/customers", label: "Customers" },
  { href: "/changelog", label: "Changelog" },
];

export function MarketingNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6 lg:px-8">
        <Logo />
        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:text-foreground",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className={buttonVariants({ variant: "ghost", size: "sm", className: "hidden sm:inline-flex" })}
          >
            Sign in
          </Link>
          <Link href="/login" className={buttonVariants({ size: "sm" })}>
            Start free trial
          </Link>
        </div>
      </nav>
    </header>
  );
}
