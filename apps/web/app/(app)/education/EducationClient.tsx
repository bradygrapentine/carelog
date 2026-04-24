"use client";

import { useState, useMemo } from "react";
import type { Guide } from "@/lib/education";
import { GuideCard } from "@/components/education/GuideCard";
import { TagFilter } from "@/components/education/TagFilter";

type Props = {
  guides: Guide[];
  topics: string[];
};

export function EducationClient({ guides, topics }: Props) {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      selectedTopic
        ? guides.filter((g) => g.topics.includes(selectedTopic))
        : guides,
    [selectedTopic, guides],
  );

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-ink)]">
          Education &amp; Guidance
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Evidence-based guides for caregivers
        </p>
      </div>

      <TagFilter
        topics={topics}
        selected={selectedTopic}
        onChange={setSelectedTopic}
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          No guides found for this topic.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((guide) => (
            <GuideCard key={guide.slug} guide={guide} />
          ))}
        </div>
      )}
    </main>
  );
}
