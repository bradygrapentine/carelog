import Link from "next/link";
import { PricingCards } from "./PricingCards";

export function PricingPreview() {
  return (
    <section className="py-20">
      <div className="mx-auto mb-12 max-w-xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-[var(--color-ink)]">
          Simple, honest pricing
        </h2>
        <p className="mt-3 text-[var(--color-muted)]">
          One plan for the whole family team.{" "}
          <Link href="/pricing" className="text-[var(--color-primary)] underline underline-offset-2">
            See full details →
          </Link>
        </p>
      </div>
      <PricingCards />
    </section>
  );
}
