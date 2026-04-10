const FEATURES = [
  {
    icon: "📋",
    title: "Care Journal",
    description:
      "Log entries with mood tags, flag important moments for the doctor, and let family react with a heart.",
  },
  {
    icon: "💊",
    title: "Medications",
    description:
      "Track medications with dosage, schedule, and administration history. Scan prescriptions with OCR.",
  },
  {
    icon: "👥",
    title: "Care Team",
    description:
      "Invite coordinators, caregivers, aides, and family supporters. Each role sees exactly what they need.",
  },
  {
    icon: "📅",
    title: "Shifts",
    description:
      "Schedule and log caregiver shifts. Know who was there, when, and what happened.",
  },
  {
    icon: "📁",
    title: "Documents",
    description:
      "Upload insurance cards, discharge summaries, and advance directives — always accessible to your team.",
  },
  {
    icon: "📬",
    title: "Weekly Digest",
    description:
      "Every Monday, your team gets a digest of the week's entries, medications, and shifts by email.",
  },
] as const;

export function FeatureGrid() {
  return (
    <section id="features" className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            Everything your care team needs
          </h2>
          <p className="mt-3 text-[var(--color-muted)]">
            Built for families who coordinate care across multiple people.
          </p>
        </div>
        <ul
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          role="list"
        >
          {FEATURES.map(({ icon, title, description }) => (
            <li
              key={title}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
            >
              <span className="text-2xl" aria-hidden="true">
                {icon}
              </span>
              <h3 className="mt-3 text-base font-semibold text-[var(--color-ink)]">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                {description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
