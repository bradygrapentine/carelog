import { OnboardingForm } from "./OnboardingForm";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        <h1 className="text-center text-2xl font-semibold text-foreground mb-2">
          Set up your care team
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-8">
          Tell us who you are coordinating care for.
        </p>
        <div className="bg-card py-8 px-6 shadow-sm border border-border rounded-xl">
          <OnboardingForm />
        </div>
      </div>
    </div>
  );
}
