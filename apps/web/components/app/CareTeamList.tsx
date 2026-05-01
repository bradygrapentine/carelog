import { User } from "lucide-react";

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
};

function MemberRow({ member }: { member: CareTeamMember }) {
  return (
    <li className="flex items-center gap-3 py-2">
      {/* Avatar */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] text-sm font-medium text-[var(--color-primary)]"
        aria-hidden="true"
      >
        {member.initials ? (
          <span>{member.initials}</span>
        ) : (
          <User
            size={18}
            strokeWidth={1.5}
            data-testid="user-icon-fallback"
          />
        )}
      </div>

      {/* Name + role */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
          {member.name}
        </p>
        <p className="truncate text-xs text-[var(--color-muted)]">
          {member.role}
        </p>
      </div>

      {/* Phone */}
      {member.phone && (
        <a
          href={`tel:${member.phone}`}
          aria-label={`Call ${member.name}`}
          className="eyebrow-mono shrink-0 text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 rounded"
        >
          {member.phone}
        </a>
      )}
    </li>
  );
}

export function CareTeamList({ members, className }: CareTeamListProps) {
  if (members.length === 0) {
    return (
      <p className={`text-sm text-[var(--color-muted)] ${className ?? ""}`}>
        No team members yet.
      </p>
    );
  }

  return (
    <ul
      className={["divide-y divide-[var(--color-border)]", className ?? ""]
        .join(" ")
        .trim()}
    >
      {members.map((member) => (
        <MemberRow key={member.id} member={member} />
      ))}
    </ul>
  );
}
