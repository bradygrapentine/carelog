import type { ReactNode } from "react";

type Section = {
  id: string;
  title: string;
};

type Props = {
  title: string;
  lastUpdated: string;
  sections: Section[];
  children: ReactNode;
};

export function LegalPageLayout({ title, lastUpdated, sections, children }: Props) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-[var(--color-ink)]">
          {title}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Last updated: {lastUpdated}
        </p>
      </div>

      <div className="flex gap-12">
        {/* TOC sidebar, desktop only */}
        <nav
          className="hidden w-48 shrink-0 lg:block"
          aria-label="Table of contents"
        >
          <ul className="sticky top-24 flex flex-col gap-2" role="list">
            {sections.map(({ id, title: sectionTitle }) => (
              <li key={id}>
                <a
                  href={"#" + id}
                  className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
                >
                  {sectionTitle}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Prose */}
        <article className="prose prose-sm max-w-2xl text-[var(--color-muted)] [&_h2]:text-[var(--color-ink)] [&_h2]:font-bold [&_h2]:text-xl [&_h2]:mt-10 [&_h2]:mb-3">
          {children}
        </article>
      </div>
    </div>
  );
}
