"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RoleBadge } from "../../../../components/ui/RoleBadge";
import { Skeleton } from "@/components/ui/skeleton";

type Member = {
  id: string;
  user_id: string;
  role: "coordinator" | "caregiver" | "aide" | "supporter";
  display_name: string | null;
  email: string | null;
};

type Props = {
  orgId: string;
  userId: string;
};

export function TeamAdminClient({ orgId, userId: _userId }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/members?orgId=" + orgId)
      .then((res) => res.json())
      .then((data) => {
        if (data.members) setMembers(data.members);
        setLoading(false);
      });
  }, [orgId]);

  async function handleRemove(memberId: string) {
    if (!confirm("Remove this team member? They will lose access immediately."))
      return;
    const res = await fetch("/api/members/" + memberId, { method: "DELETE" });
    if (res.ok) setMembers((prev) => prev.filter((m) => m.id !== memberId));
    else setError("Failed to remove member. Please try again.");
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 space-y-4">
        <Skeleton className="h-8 w-36 rounded" />
        <Skeleton className="h-4 w-64 rounded" />
        <div className="space-y-3 mt-6">
          <Skeleton className="h-12 w-full rounded" />
          <Skeleton className="h-12 w-full rounded" />
          <Skeleton className="h-12 w-full rounded" />
          <Skeleton className="h-12 w-full rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold text-[var(--color-ink)]">Team Admin</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Manage your care team members and organization settings.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]"
        >
          {error}
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-ink)]">
          Members
        </h2>
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted)]">
                  Member
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted)]">
                  Role
                </th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-[var(--color-border)] last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-semibold text-white">
                        {(member.display_name ?? member.email ?? "?")
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                      <div>
                        <p className="font-medium text-[var(--color-ink)]">
                          {member.display_name ?? member.email ?? "Team member"}
                        </p>
                        {member.display_name && member.email && (
                          <p className="text-xs text-[var(--color-muted)]">
                            {member.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={member.role} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {member.role !== "coordinator" && (
                      <button
                        onClick={() => handleRemove(member.id)}
                        className="rounded text-xs font-medium text-[var(--color-danger)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-danger)] focus:ring-offset-1"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-danger)]">
          Danger zone
        </h2>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            Delete organization
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Permanently deletes your organization and all care data. This cannot
            be undone. Your data is retained for 30 days before permanent
            removal.
          </p>
          <button
            className="mt-4 rounded-xl border-2 border-[var(--color-danger)] px-4 py-2 text-sm font-semibold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-danger)] focus:ring-offset-2"
            onClick={() => {
              if (confirm("Are you absolutely sure? This cannot be undone.")) {
                toast.error(
                  "Delete org: not yet implemented. Contact hello@carelog.app.",
                );
              }
            }}
          >
            Delete organization
          </button>
        </div>
      </section>
    </div>
  );
}
