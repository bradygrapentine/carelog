type LikesDislikesListProps = {
  likes: string[];
  dislikes: string[];
  className?: string;
};

function Column({
  label,
  items,
}: {
  label: "LIKES" | "DISLIKES";
  items: string[];
}) {
  return (
    <section aria-labelledby={`ldl-heading-${label.toLowerCase()}`}>
      <p
        id={`ldl-heading-${label.toLowerCase()}`}
        className="eyebrow-mono mb-2"
      >
        {label}
      </p>
      <ul
        aria-label={label}
        className="list-disc list-inside space-y-1 text-sm text-[var(--color-text-primary)]"
      >
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
      {items.length === 0 && (
        <p className="text-sm text-[var(--color-muted)]">Nothing recorded yet.</p>
      )}
    </section>
  );
}

export function LikesDislikesList({
  likes,
  dislikes,
  className,
}: LikesDislikesListProps) {
  return (
    <div
      className={[
        "grid grid-cols-1 gap-4 sm:grid-cols-2",
        className ?? "",
      ]
        .join(" ")
        .trim()}
    >
      <Column label="LIKES" items={likes} />
      <Column label="DISLIKES" items={dislikes} />
    </div>
  );
}
