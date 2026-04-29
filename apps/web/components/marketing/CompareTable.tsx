type Cell = {
  value: string;
  symbol?: "check" | "cross" | "partial";
};

type Row = {
  feature: string;
  carelog: Cell;
  caringbridge: Cell;
  lotsa: Cell;
};

const rows: Row[] = [
  {
    feature: "Built for",
    carelog: { value: "Day-to-day family care" },
    caringbridge: { value: "Sharing health updates" },
    lotsa: { value: "Coordinating community help" },
  },
  {
    feature: "Care journal with reactions",
    carelog: { value: "Yes", symbol: "check" },
    caringbridge: { value: "One-way blog", symbol: "partial" },
    lotsa: { value: "No", symbol: "cross" },
  },
  {
    feature: "Medication tracking",
    carelog: { value: "Yes", symbol: "check" },
    caringbridge: { value: "No", symbol: "cross" },
    lotsa: { value: "No", symbol: "cross" },
  },
  {
    feature: "Caregiver shift schedule",
    carelog: { value: "Yes", symbol: "check" },
    caringbridge: { value: "No", symbol: "cross" },
    lotsa: { value: "Calendar only", symbol: "partial" },
  },
  {
    feature: "Documents vault",
    carelog: { value: "Yes", symbol: "check" },
    caringbridge: { value: "No", symbol: "cross" },
    lotsa: { value: "No", symbol: "cross" },
  },
  {
    feature: "Whole-team roles (caregiver / aide / family)",
    carelog: { value: "Yes", symbol: "check" },
    caringbridge: { value: "No", symbol: "cross" },
    lotsa: { value: "Volunteers only", symbol: "partial" },
  },
  {
    feature: "Private + ad-free",
    carelog: { value: "$14/mo family", symbol: "check" },
    caringbridge: { value: "Donation-supported", symbol: "partial" },
    lotsa: { value: "Ad-supported", symbol: "cross" },
  },
  {
    feature: "HIPAA-conscious",
    carelog: { value: "Yes", symbol: "check" },
    caringbridge: { value: "Limited", symbol: "partial" },
    lotsa: { value: "No", symbol: "cross" },
  },
  {
    feature: "Founded",
    carelog: { value: "2026" },
    caringbridge: { value: "1997" },
    lotsa: { value: "2007" },
  },
];

function SymbolBadge({
  symbol,
  value,
}: {
  symbol?: Cell["symbol"];
  value: string;
}) {
  if (symbol === "check") {
    return (
      <span className="flex items-center gap-1.5">
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-success)]/15 text-[var(--color-success)]"
          aria-hidden="true"
        >
          ✓
        </span>
        <span className="text-sm text-[var(--color-ink)]">{value}</span>
      </span>
    );
  }
  if (symbol === "cross") {
    return (
      <span className="flex items-center gap-1.5">
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
          aria-hidden="true"
        >
          ✕
        </span>
        <span className="sr-only">No</span>
      </span>
    );
  }
  if (symbol === "partial") {
    return (
      <span className="flex items-center gap-1.5">
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-secondary-subtle)] text-[var(--color-secondary)]"
          aria-hidden="true"
        >
          ~
        </span>
        <span className="text-sm text-[var(--color-ink)]">{value}</span>
      </span>
    );
  }
  return <span className="text-sm text-[var(--color-ink)]">{value}</span>;
}

export function CompareTable() {
  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-8">
      {/* Desktop table, md and up */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-[var(--color-border)] shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th
                scope="col"
                className="px-6 py-4 text-left font-semibold text-[var(--color-muted)] w-1/4"
              >
                Feature
              </th>
              <th
                scope="col"
                className="px-6 py-4 text-left font-semibold text-[var(--color-app-shell-text)] bg-[var(--color-primary)] w-1/4"
              >
                CareSync
              </th>
              <th
                scope="col"
                className="px-6 py-4 text-left font-semibold text-[var(--color-ink)] bg-[var(--color-surface)] w-1/4"
              >
                CaringBridge
              </th>
              <th
                scope="col"
                className="px-6 py-4 text-left font-semibold text-[var(--color-ink)] bg-[var(--color-surface)] w-1/4"
              >
                Lotsa Helping Hands
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.feature} className="bg-[var(--color-surface)]">
                <td className="px-6 py-4 font-medium text-[var(--color-ink)]">
                  {row.feature}
                </td>
                <td className="px-6 py-4 bg-[var(--color-primary-subtle)]/30">
                  <SymbolBadge
                    symbol={row.carelog.symbol}
                    value={row.carelog.value}
                  />
                </td>
                <td className="px-6 py-4">
                  <SymbolBadge
                    symbol={row.caringbridge.symbol}
                    value={row.caringbridge.value}
                  />
                </td>
                <td className="px-6 py-4">
                  <SymbolBadge
                    symbol={row.lotsa.symbol}
                    value={row.lotsa.value}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards, below md */}
      <div className="space-y-4 md:hidden">
        {rows.map((row) => (
          <div
            key={row.feature}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm overflow-hidden"
          >
            <div className="px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
              <p className="text-sm font-semibold text-[var(--color-ink)]">
                {row.feature}
              </p>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-primary-subtle)]/30">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                  CareSync
                </span>
                <SymbolBadge
                  symbol={row.carelog.symbol}
                  value={row.carelog.value}
                />
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-medium text-[var(--color-muted)]">
                  CaringBridge
                </span>
                <SymbolBadge
                  symbol={row.caringbridge.symbol}
                  value={row.caringbridge.value}
                />
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-medium text-[var(--color-muted)]">
                  Lotsa Helping Hands
                </span>
                <SymbolBadge
                  symbol={row.lotsa.symbol}
                  value={row.lotsa.value}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
