import { Search } from "lucide-react";

type SageTopBarProps = {
  title: string;
  crumb?: string;
  searchPlaceholder?: string;
  showSearch?: boolean;
  action?: React.ReactNode;
};

export function SageTopBar({
  title,
  crumb,
  searchPlaceholder = "Search Margaret's record",
  showSearch = true,
  action,
}: SageTopBarProps) {
  return (
    <header className="flex items-center gap-3 px-6 py-3 bg-[var(--color-surface)] border-b border-[var(--color-border)] min-h-[56px]">
      {/* Crumb + title */}
      <div className="flex items-center gap-1 min-w-0 flex-1">
        {crumb && (
          <span data-testid="topbar-crumb" className="flex items-center gap-1">
            <span className="text-sm text-[var(--color-muted)] truncate">
              {crumb}
            </span>
            <span
              className="text-sm text-[var(--color-border)] select-none"
              aria-hidden="true"
            >
              /
            </span>
          </span>
        )}
        <h1 className="text-lg font-semibold text-[var(--color-ink)] truncate leading-tight">
          {title}
        </h1>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <label htmlFor="topbar-search" className="sr-only">
            Search
          </label>
          <div className="relative flex items-center">
            <Search
              className="absolute left-3 h-4 w-4 text-[var(--color-muted)] pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="topbar-search"
              type="search"
              placeholder={searchPlaceholder}
              className="pl-9 pr-14 py-2 h-9 w-64 rounded-full border border-[var(--color-border)] bg-white text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 focus:border-transparent"
            />
            <kbd className="absolute right-3 inline-flex items-center gap-0.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-muted)] pointer-events-none select-none">
              ⌘K
            </kbd>
          </div>
        </div>
      )}

      {/* Action slot */}
      {action && <div className="flex-shrink-0">{action}</div>}
    </header>
  );
}
