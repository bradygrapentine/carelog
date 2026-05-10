"use client";

type Props = {
  topics: string[];
  selected: string | null;
  onChange: (topic: string | null) => void;
};

export function TagFilter({ topics, selected, onChange }: Props) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Filter by topic"
    >
      <button
        onClick={() => onChange(null)}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1 ${
          selected === null
            ? "bg-[var(--color-primary-pressed)] text-white"
            : "bg-[var(--color-primary-subtle)] text-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] hover:text-white"
        }`}
        aria-pressed={selected === null}
      >
        All
      </button>
      {topics.map((topic) => (
        <button
          key={topic}
          onClick={() => onChange(topic)}
          className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1 ${
            selected === topic
              ? "bg-[var(--color-primary-pressed)] text-white"
              : "bg-[var(--color-primary-subtle)] text-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] hover:text-white"
          }`}
          aria-pressed={selected === topic}
        >
          {topic.replace(/-/g, " ")}
        </button>
      ))}
    </div>
  );
}
