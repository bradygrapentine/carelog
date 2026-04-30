"use client";

/**
 * UX-058 — Team "Now Board" — care-team members grouped by current shift state.
 *
 * Pure presentational. Caller resolves status; this just groups + renders.
 */

export type TeamMemberStatus = "on" | "next" | "later" | "off";

export type TeamMember = {
  /** Stable id; React key + aria-label root. */
  id: string;
  name: string;
  status: TeamMemberStatus;
  /** Optional — short detail line shown below name. e.g. "8a–2p · day shift" */
  detail?: string;
};

export type TeamNowBoardProps = {
  members: TeamMember[];
};

const GROUP_ORDER: TeamMemberStatus[] = ["on", "next", "later", "off"];
const GROUP_LABELS: Record<TeamMemberStatus, string> = {
  on: "On now",
  next: "Up next",
  later: "Later today",
  off: "Off",
};

export function TeamNowBoard({ members }: TeamNowBoardProps) {
  const groups: Record<TeamMemberStatus, TeamMember[]> = {
    on: [],
    next: [],
    later: [],
    off: [],
  };
  for (const m of members) groups[m.status].push(m);

  return (
    <section
      aria-labelledby="team-now-board-heading"
      data-testid="team-now-board"
      className="space-y-3"
    >
      <h3
        id="team-now-board-heading"
        className="text-sm font-semibold text-[var(--color-ink)]"
      >
        Care team — right now
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {GROUP_ORDER.map((key) => (
          <div
            key={key}
            data-testid={`group-${key}`}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
          >
            <p className="eyebrow-mono">{GROUP_LABELS[key]}</p>
            {groups[key].length === 0 ? (
              <p
                className="mt-2 text-xs text-[var(--color-muted)]"
                data-testid={`group-${key}-empty`}
              >
                Nobody.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {groups[key].map((m) => (
                  <li
                    key={m.id}
                    data-testid={`member-${m.id}`}
                    className="flex items-center gap-2"
                  >
                    <span
                      aria-hidden="true"
                      className={[
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                        key === "on"
                          ? "bg-[var(--color-success)] text-white"
                          : key === "next"
                            ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                            : "bg-[var(--color-surface-muted)] text-[var(--color-muted)]",
                      ].join(" ")}
                    >
                      {m.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--color-text-primary)]">
                        {m.name}
                      </p>
                      {m.detail && (
                        <p className="truncate text-[11px] text-[var(--color-muted)]">
                          {m.detail}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
