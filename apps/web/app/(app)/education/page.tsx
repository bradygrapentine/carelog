"use client";

import { useState, useMemo } from "react";
import { getAllGuides } from "@/lib/education";
import { GuideCard } from "@/components/education/GuideCard";
import { TagFilter } from "@/components/education/TagFilter";

// Load guides at module level (runs server-side at build time in Next.js)
const allGuides = getAllGuides();
const allTopics = Array.from(
  new Set(allGuides.flatMap((g) => g.topics))
).sort();

export default function EducationPage() {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      selectedTopic
        ? allGuides.filter((g) => g.topics.includes(selectedTopic))
        : allGuides,
    [selectedTopic],
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
        topics={allTopics}
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
