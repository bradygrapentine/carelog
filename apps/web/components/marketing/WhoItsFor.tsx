import Image from "next/image";

const personas = [
  {
    title: "Adult children",
    body: "Managing mom or dad's appointments, medications, and mood while holding down a full-time job — and keeping siblings in the loop without a group text spiral.",
    src: "/images/hero-5.png",
    alt: "An adult daughter sitting and talking warmly with her elderly mother at home",
  },
  {
    title: "Spouses and partners",
    body: "Caring for a partner through chronic illness or disability. One shared source of truth so nothing falls through the cracks between you, doctors, and hired help.",
    src: "/images/hero-4.png",
    alt: "A caregiver walking alongside an elderly man in a park on an autumn day",
  },
  {
    title: "Professional caregivers",
    body: "Aides and companions who want to hand off shift notes cleanly, log medications with confidence, and give the family calm visibility into each visit.",
    src: "/images/hero-3.png",
    alt: "A physical therapist and parent supporting a young child learning to walk with a walker",
  },
];

export function WhoItsFor() {
  return (
    <section id="who-its-for" className="mx-auto max-w-7xl px-6 py-20 md:py-28">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
          Who Carelog is for
        </p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-4xl">
          Built for the people holding it all together
        </h2>
        <p className="mt-4 text-base leading-relaxed text-[var(--color-text-secondary)]">
          Carelog is designed for the daily reality of caring for an aging
          parent, a partner with a chronic condition, or a loved one with a
          disability. Whoever is showing up, we make it easier to do it
          together.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {personas.map((p) => (
          <article
            key={p.title}
            className="group flex flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              <Image
                src={p.src}
                alt={p.alt}
                fill
                sizes="(min-width: 768px) 30vw, 90vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2 p-6">
              <h3 className="text-lg font-semibold text-[var(--color-ink)]">
                {p.title}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {p.body}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
