"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

type CareTeamMember = {
  id: string;
  name: string;
  role: string;
  phone?: string;
  initials?: string;
};

type CareTeamListProps = {
  members: CareTeamMember[];
  className?: string;
  /** Org the team belongs to. Required for mutations when editable. */
  orgId?: string;
  /** Recipient context for new invites (null = org-wide invite). */
  recipientId?: string | null;
  /** When true, render the invite-new + per-row remove affordances. */
  editable?: boolean;
  /** Caller's own membership id. Hides the remove button on their own row. */
  currentMembershipId?: string | null;
};

type Role = "coordinator" | "caregiver" | "supporter" | "aide";
const ROLES: Role[] = ["coordinator", "caregiver", "supporter", "aide"];

function MemberRow({
  member,
  editable,
  showRemove,
  isConfirming,
  isPending,
  onRemoveClick,
}: {
  member: CareTeamMember;
  editable: boolean;
  showRemove: boolean;
  isConfirming: boolean;
  isPending: boolean;
  onRemoveClick: () => void;
}) {
  return (
    <li className="flex items-center gap-3 py-2">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] text-sm font-medium text-[var(--color-primary)]"
        aria-hidden="true"
      >
        {member.initials ? (
          <span>{member.initials}</span>
        ) : (
          <User size={18} strokeWidth={1.5} data-testid="user-icon-fallback" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
          {member.name}
        </p>
        <p className="truncate text-xs text-[var(--color-muted)]">
          {member.role}
        </p>
      </div>

      {member.phone && (
        <a
          href={`tel:${member.phone}`}
          aria-label={`Call ${member.name}`}
          className="eyebrow-mono shrink-0 text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 rounded"
        >
          {member.phone}
        </a>
      )}

      {editable && showRemove && (
        <button
          type="button"
          onClick={onRemoveClick}
          disabled={isPending}
          aria-label={
            isConfirming
              ? `Confirm remove ${member.name}`
              : `Remove ${member.name}`
          }
          className="shrink-0 text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 rounded px-2 py-1 disabled:opacity-50"
        >
          {isConfirming ? "Confirm?" : "Remove"}
        </button>
      )}
    </li>
  );
}

export function CareTeamList({
  members,
  className,
  orgId,
  recipientId = null,
  editable = false,
  currentMembershipId = null,
}: CareTeamListProps) {
  const router = useRouter();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("caregiver");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(
    null,
  );
  const [removeError, setRemoveError] = useState<string | null>(null);

  const inviteMutation = trpc.memberships.invite.useMutation({
    onSuccess: () => {
      setShowInviteForm(false);
      setInviteEmail("");
      setInviteRole("caregiver");
      setInviteError(null);
      router.refresh();
    },
    onError: () => {
      setInviteError("Failed to invite. Check the email and try again.");
    },
  });

  const removeMutation = trpc.memberships.remove.useMutation({
    onSuccess: () => {
      setConfirmingRemoveId(null);
      setRemoveError(null);
      router.refresh();
    },
    onError: () => {
      setConfirmingRemoveId(null);
      setRemoveError("Failed to remove member.");
    },
  });

  const showEditAffordances = editable && Boolean(orgId);

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setInviteError(null);
    inviteMutation.mutate({
      orgId,
      recipientId,
      role: inviteRole,
      email: inviteEmail,
    });
  };

  const handleRemoveClick = (membershipId: string) => {
    if (!orgId) return;
    if (confirmingRemoveId === membershipId) {
      removeMutation.mutate({ orgId, membershipId });
    } else {
      setConfirmingRemoveId(membershipId);
      setRemoveError(null);
    }
  };

  const empty = members.length === 0;

  return (
    <div className={className ?? ""}>
      {showEditAffordances && (
        <div className="mb-2 flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              setShowInviteForm((v) => !v);
              setInviteError(null);
            }}
            aria-expanded={showInviteForm}
            className="text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 rounded px-2 py-1"
          >
            {showInviteForm ? (
              <span className="inline-flex items-center gap-1">
                <X size={12} strokeWidth={2} aria-hidden="true" /> Cancel
              </span>
            ) : (
              "+ Invite member"
            )}
          </button>
        </div>
      )}

      {showEditAffordances && showInviteForm && (
        <form
          onSubmit={handleInviteSubmit}
          className="mb-3 space-y-2 rounded border border-[var(--color-border)] bg-[var(--color-primary-subtle)] p-3"
        >
          <div>
            <label
              htmlFor="careteam-invite-email"
              className="block text-xs font-medium text-[var(--color-text-primary)] mb-1"
            >
              Email
            </label>
            <input
              id="careteam-invite-email"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={inviteMutation.isPending}
              className="w-full rounded border border-[var(--color-border)] bg-white px-2 py-1 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1"
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="careteam-invite-role"
              className="block text-xs font-medium text-[var(--color-text-primary)] mb-1"
            >
              Role
            </label>
            <select
              id="careteam-invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              disabled={inviteMutation.isPending}
              className="w-full rounded border border-[var(--color-border)] bg-white px-2 py-1 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {inviteError && (
            <p role="alert" className="text-xs text-[var(--color-danger)]">
              {inviteError}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={inviteMutation.isPending}
              className="rounded bg-[var(--color-primary)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 disabled:opacity-50"
            >
              {inviteMutation.isPending ? "Sending…" : "Send invite"}
            </button>
          </div>
        </form>
      )}

      {removeError && (
        <p role="alert" className="mb-2 text-xs text-[var(--color-danger)]">
          {removeError}
        </p>
      )}

      {empty ? (
        <p className="text-sm text-[var(--color-muted)]">
          No team members yet.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              editable={showEditAffordances}
              showRemove={member.id !== currentMembershipId}
              isConfirming={confirmingRemoveId === member.id}
              isPending={
                removeMutation.isPending && confirmingRemoveId === member.id
              }
              onRemoveClick={() => handleRemoveClick(member.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
