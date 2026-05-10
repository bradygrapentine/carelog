"use client";

type Medication = {
  id: string;
  drug_name: string;
  brand_name: string | null;
};

type Props = {
  medications: Medication[];
  selected: string | null;
  onSelect: (id: string | null) => void;
};

export function MedicationChipBar({ medications, selected, onSelect }: Props) {
  if (medications.length === 0) return null;

  return (
    <div
      className="flex gap-2 overflow-x-auto py-2"
      role="group"
      aria-label="Filter by medication"
    >
      <button
        type="button"
        aria-pressed={selected === null}
        onClick={() => onSelect(null)}
        className={
          "flex-shrink-0 px-3 py-1 text-sm rounded-full font-medium transition-colors " +
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 " +
          (selected === null
            ? "bg-[var(--color-primary-pressed)] text-white"
            : "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]")
        }
      >
        All
      </button>
      {medications.map((med) => {
        const isSelected = selected === med.id;
        return (
          <button
            key={med.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(med.id)}
            className={
              "flex-shrink-0 px-3 py-1 text-sm rounded-full font-medium transition-colors " +
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 " +
              (isSelected
                ? "bg-[var(--color-primary-pressed)] text-white"
                : "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]")
            }
          >
            {med.drug_name}
          </button>
        );
      })}
    </div>
  );
}
