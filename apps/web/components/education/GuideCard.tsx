import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Guide } from "@/lib/education";

export function GuideCard({ guide }: { guide: Guide }) {
  return (
    <Link href={`/education/${guide.slug}`} className="block group">
      <Card className="shadow-sm hover:shadow-md transition-shadow duration-150 h-full">
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-primary)] transition-colors">
            {guide.title}
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-2">
            {guide.summary}
          </p>
          <div className="flex flex-wrap gap-1 pt-1">
            {guide.challenges.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-[10px] bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border-0"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
