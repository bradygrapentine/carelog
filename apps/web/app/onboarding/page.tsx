import { OnboardingForm } from "./OnboardingForm";
import { PostHogInit } from "../../components/PostHogInit";
import { MarketingNavSlim } from "@/components/marketing/MarketingNavSlim";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <PostHogInit />
      <MarketingNavSlim />
      <div className="flex flex-col py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-lg">
          <h1 className="headline-display text-center text-3xl text-[var(--color-ink)] mb-2">
            Set up your <em>care team</em>
          </h1>
          <p className="text-center text-sm text-muted-foreground mb-8">
            Tell us who you are coordinating care for.
          </p>
          <div className="bg-card py-8 px-6 shadow-sm border border-border rounded-xl">
            <OnboardingForm />
          </div>
        </div>
      </div>
    </div>
  );
}
