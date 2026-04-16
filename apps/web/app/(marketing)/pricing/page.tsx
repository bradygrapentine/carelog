import type { Metadata } from "next";
import { PricingCards } from "../../../components/marketing/PricingCards";

export const metadata: Metadata = {
  title: "Pricing — CareSync",
  description: "Simple pricing for families. $14/mo covers everyone.",
};

export default function PricingPage() {
  return (
    <div className="py-20">
      <div className="mx-auto mb-12 max-w-2xl px-6 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
          Pricing
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-[var(--color-ink)]">
          Simple pricing for the whole family
        </h1>
        <p className="mt-4 text-[var(--color-muted)]">
          One family plan covers every member of your care team — coordinators,
          caregivers, aides, and family supporters.
        </p>
      </div>
      <PricingCards />
    </div>
  );
}
