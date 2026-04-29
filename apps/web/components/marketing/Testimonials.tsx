import Image from "next/image";

const quotes = [
  {
    quote:
      "My brother and I live six hours apart. Before CareSync we were constantly on the phone guessing what mom had eaten or whether she'd taken her afternoon meds. Now it's all just… there.",
    name: "Priya S.",
    role: "Daughter · primary coordinator",
    avatar:
      "https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&w=200&q=80",
  },
  {
    quote:
      "I've been a home health aide for twelve years. CareSync is the first tool that actually respects how families want to communicate about their loved one. I leave every shift feeling like I handed the baton cleanly.",
    name: "Marcus T.",
    role: "Professional caregiver",
    avatar:
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=200&q=80",
  },
  {
    quote:
      "My dad has early Parkinson's and I have three siblings with strong opinions. The shared journal turned what used to be endless arguments into quiet updates. That alone was worth it.",
    name: "Anna R.",
    role: "Daughter · family of four",
    avatar:
      "https://images.unsplash.com/photo-1578496781985-452d4a934d50?auto=format&fit=crop&w=200&q=80",
  },
];

export function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <p className="eyebrow-mono">From the families who show up</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
          Calmer days, fewer dropped threads
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {quotes.map((q) => (
          <figure
            key={q.name}
            className="flex h-full flex-col justify-between rounded-2xl bg-card p-6 shadow-sm"
          >
            <blockquote className="text-sm leading-relaxed text-[var(--color-text-primary)]">
              <span
                aria-hidden="true"
                className="mr-1 text-2xl leading-none text-[var(--color-primary)]"
              >
                &ldquo;
              </span>
              {q.quote}
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-3">
              <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-[var(--color-primary-subtle)]">
                <Image
                  src={q.avatar}
                  alt={`Portrait of ${q.name}`}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-[var(--color-ink)]">
                  {q.name}
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {q.role}
                </span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
