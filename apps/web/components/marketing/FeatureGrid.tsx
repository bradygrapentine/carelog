import {
  BookOpen,
  Pill,
  CalendarDays,
  Users,
  Activity,
  BatteryLow,
  Mail,
  FolderOpen,
  Landmark,
  HandHelping,
  Receipt,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

type Feature = {
  Icon: LucideIcon;
  title: string;
  description: string;
};

const DAILY: Feature[] = [
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

const PASSIVE: Feature[] = [
  {
    Icon: Activity,
    title: "Symptom tracking",
    description:
      "Log pain, mood, appetite, and mobility. Spot trends and share them with the doctor at the next visit.",
  },
  {
    Icon: BatteryLow,
    title: "Burnout check-ins",
    description:
      "Weekly private check-ins for every caregiver. Coordinators see a team summary when someone's running low.",
  },
  {
    Icon: Mail,
    title: "Weekly Digest",
    description:
      "Every Monday, your team gets a digest of the week's entries, medications, and shifts by email.",
  },
  {
    Icon: FolderOpen,
    title: "Documents",
    description:
      "Upload insurance cards, discharge summaries, and advance directives, always accessible to your team.",
  },
];

const EXTENDED: Feature[] = [
  {
    Icon: Landmark,
    title: "Benefits navigator",
    description:
      "Screen your recipient against Medicare, Medicaid, SNAP, VA, and hospice programs in a few minutes.",
  },
  {
    Icon: HandHelping,
    title: "Volunteer requests",
    description:
      "A shareable link for neighbors, friends, and faith communities to sign up for meals, rides, and visits.",
  },
  {
    Icon: Receipt,
    title: "Shared expense log",
    description:
      "Track out-of-pocket costs across the team. Categorized, searchable, and ready for tax season.",
  },
  {
    Icon: ScrollText,
    title: "End-of-life planner",
    description:
      "A private, coordinator-only space for advance directives, preferences, and the hardest conversations.",
  },
];

type GroupTone = "primary" | "secondary" | "tertiary";

const TONE_CLASSES: Record<GroupTone, { bg: string; fg: string }> = {
  primary: {
    bg: "bg-[var(--color-primary-subtle)]",
    fg: "text-[var(--color-primary)]",
  },
  secondary: {
    bg: "bg-[var(--color-secondary-subtle)]",
    fg: "text-[var(--color-secondary)]",
  },
  tertiary: {
    bg: "bg-[var(--color-tertiary-subtle)]",
    fg: "text-[var(--color-tertiary)]",
  },
};

function SpotlightGroup({
  eyebrow,
  intro,
  features,
  tone,
}: {
  eyebrow: string;
  intro: string;
  features: Feature[];
  tone: GroupTone;
}) {
  const { bg, fg } = TONE_CLASSES[tone];
  return (
    <section className="mt-16 first:mt-0">
      <div className="mb-6 max-w-2xl">
        <p className="eyebrow-mono">{eyebrow}</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {intro}
        </p>
      </div>
      <ul className="grid gap-5 sm:grid-cols-2" role="list">
        {features.map(({ Icon, title, description }) => (
          <li
            key={title}
            className="rounded-2xl bg-[var(--color-surface)] p-7 shadow-sm"
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${bg}`}
              aria-hidden="true"
            >
              <Icon className={`h-6 w-6 ${fg}`} strokeWidth={1.75} />
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
    </section>
  );
}

function ListGroup({
  eyebrow,
  features,
  tone,
}: {
  eyebrow: string;
  features: Feature[];
  tone: GroupTone;
}) {
  const { bg, fg } = TONE_CLASSES[tone];
  return (
    <section className="mt-16">
      <p className="eyebrow-mono mb-6">{eyebrow}</p>
      <dl className="grid gap-x-12 gap-y-7 md:grid-cols-2">
        {features.map(({ Icon, title, description }) => (
          <div key={title} className="flex gap-4">
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bg}`}
              aria-hidden="true"
            >
              <Icon className={`h-[18px] w-[18px] ${fg}`} strokeWidth={1.75} />
            </span>
            <div>
              <dt className="text-base font-semibold text-[var(--color-ink)]">
                {title}
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {description}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function FeatureGrid() {
  return (
    <section id="features" className="bg-card py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
            The things a group text can&apos;t do
          </h2>
          <p className="mt-3 text-[var(--color-text-secondary)]">
            Built for families who coordinate care across multiple people.
          </p>
        </div>

        <SpotlightGroup
          eyebrow="Day to day"
          intro="The four surfaces caregivers open every day, often one-handed at 11pm."
          features={DAILY}
          tone="primary"
        />

        <ListGroup
          eyebrow="Stay in the loop"
          features={PASSIVE}
          tone="secondary"
        />

        <ListGroup
          eyebrow="When it's more than the family"
          features={EXTENDED}
          tone="tertiary"
        />
      </div>
    </section>
  );
}
