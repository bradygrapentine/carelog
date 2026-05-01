"use client";

/**
 * UX-084 — Shift Team List.
 *
 * Pure presentational. Stacked rows with avatar (initials or User icon),
 * name, role, optional shiftLabel, optional phone link.
 * Caller pre-resolves all data; no tRPC calls inside.
 */

import { User } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export type ShiftTeamMember = {
  id: string;
  name: string;
  /** e.g. "Day shift", "Evenings", "Weekends" */
  role: string;
  /** e.g. "8a–4p Mon/Wed/Fri" */
  shiftLabel?: string;
  phone?: string;
  initials?: string;
};

export type ShiftTeamListProps = {
  members: ShiftTeamMember[];
  className?: string;
};

export function ShiftTeamList({ members, className }: ShiftTeamListProps) {
  return (
    <Card className={["shadow-sm gap-2", className].filter(Boolean).join(" ")}>
      <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
        <p className="text-sm font-semibold text-[var(--color-ink)]">
          Care Team
        </p>
      </CardHeader>
      <CardContent className="pt-2 px-4 pb-4">
        {members.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            No team members on this shift.
          </p>
        ) : (
          <ul className="space-y-3">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3"
              >
                {/* Avatar */}
                <div
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] text-sm font-semibold select-none"
                >
                  {m.initials ? (
                    m.initials
                  ) : (
                    <User
                      aria-hidden="true"
                      className="h-5 w-5"
                    />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--color-ink)] truncate">
                    {m.name}
                  </p>
                  <p className="text-xs text-[var(--color-muted)] truncate">
                    {m.role}
                  </p>
                  {m.shiftLabel ? (
                    <p className="text-xs text-[var(--color-muted)] truncate">
                      {m.shiftLabel}
                    </p>
                  ) : null}
                </div>

                {/* Phone */}
                {m.phone ? (
                  <a
                    href={`tel:${m.phone}`}
                    aria-label={`Call ${m.name}`}
                    className="shrink-0 font-mono text-xs text-[var(--color-primary)] uppercase tracking-wider hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 rounded"
                  >
                    {m.phone}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
