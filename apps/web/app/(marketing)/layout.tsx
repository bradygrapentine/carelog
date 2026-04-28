import type { ReactNode } from "react";
import { MarketingNav } from "../../components/marketing/MarketingNav";
import { MarketingFooter } from "../../components/marketing/MarketingFooter";

/**
 * Marketing layout — all routes under (marketing)/ are statically rendered at
 * build time (Next.js SSG). Prod LCP measured 2026-04-28: / 86ms, /pricing
 * 61ms, /contact 63ms (desktop, unthrottled). Dev-mode feels slower due to
 * RSC/HMR recompilation on first hit; this is expected and not a prod concern.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-surface)]">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
