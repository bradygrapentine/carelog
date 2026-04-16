import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getGuideBySlug, getAllGuides } from "@/lib/education";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return getAllGuides().map((g) => ({ slug: g.slug }));
}

export default async function GuideDetailPage({ params }: Props) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <Link
        href="/education"
        className="text-xs text-[var(--color-primary)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded"
      >
        ← Back to Education
      </Link>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">
          {guide.title}
        </h1>
        <div className="flex flex-wrap gap-2">
          {guide.challenges.map((tag) => (
            <Badge
              key={tag}
              className="bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border-0 text-xs"
            >
              {tag}
            </Badge>
          ))}
          {guide.topics.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-xs text-[var(--color-muted)] border-[var(--color-border)]"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Quick tips */}
      <div className="bg-[var(--color-primary-subtle)] rounded-lg p-4 space-y-2">
        <h2 className="text-sm font-semibold text-[var(--color-primary)]">
          Quick Tips
        </h2>
        <ul className="space-y-1">
          {guide.tips.map((tip, i) => (
            <li key={i} className="text-sm text-[var(--color-text-primary)] flex gap-2">
              <span className="text-[var(--color-primary)] shrink-0">•</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      {/* MDX body */}
      <div className="prose prose-sm max-w-none text-[var(--color-text-primary)]">
        <MDXRemote source={guide.content} />
      </div>

      {/* External link */}
      {guide.external_url && (
        <a
          href={guide.external_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-[var(--color-secondary)] hover:underline bg-[var(--color-secondary-subtle)] px-4 py-3 rounded-lg w-fit focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]"
        >
          Read full guide from authoritative source →
        </a>
      )}
    </main>
  );
}
