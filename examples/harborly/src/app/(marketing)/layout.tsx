import type { ReactNode } from "react";
import { CookieBanner } from "./_components/cookie-banner";
import { MarketingFooter } from "./_components/marketing-footer";
import { MarketingNav } from "./_components/marketing-nav";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
      <CookieBanner />
    </div>
  );
}
