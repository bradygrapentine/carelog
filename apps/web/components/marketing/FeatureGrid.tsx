import {
  BookOpen,
  Pill,
  CalendarDays,
  Users,
  type LucideIcon,
} from "lucide-react";

type Feature = {
  Icon: LucideIcon;
  title: string;
  description: string;
};

const FEATURES: Feature[] = [
  {
    Icon: BookOpen,
    title: "Care Journal",
    description:
      "Log entries with mood tags, flag important moments for the doctor, and let family react with a heart.",
  },
  {
    Icon: Pill,
    title: "Medications",
    description:
      "Track medications with dosage, schedule, and administration history. Scan prescriptions with OCR.",
  },
  {
    Icon: CalendarDays,
    title: "Shifts",
    description:
      "Schedule and log caregiver shifts. Know who was there, when, and what happened.",
  },
  {
    Icon: Users,
    title: "Care Team",
    description:
      "Invite coordinators, caregivers, aides, and family supporters. Each role sees exactly what they need.",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="bg-card py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
            The things a group text can&apos;t do
          </h2>
          <p className="mt-3 text-[var(--color-text-secondary)]">
            The four surfaces caregivers open every day, often one-handed at
            11pm.
          </p>
        </div>

        <ul className="grid gap-5 sm:grid-cols-2" role="list">
          {FEATURES.map(({ Icon, title, description }) => (
            <li
              key={title}
              className="rounded-2xl bg-[var(--color-surface)] p-7 shadow-sm"
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary-subtle)]"
                aria-hidden="true"
              >
                <Icon
                  className="h-6 w-6 text-[var(--color-primary)]"
                  strokeWidth={1.75}
                />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-[var(--color-ink)]">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
