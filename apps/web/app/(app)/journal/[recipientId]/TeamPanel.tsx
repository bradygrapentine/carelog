"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type Member = {
  id: string;
  role: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
};

type Props = {
  readonly members: Member[];
  readonly currentUserId: string;
  readonly canInvite: boolean;
  readonly onInvite: (email: string, role: string) => Promise<void>;
  readonly showInvite: boolean;
  readonly onToggleInvite: () => void;
};

const ROLE_BADGE: Record<string, string> = {
  coordinator:
    "bg-[var(--color-primary-subtle)] text-primary border-[var(--color-border)]",
  caregiver:
    "bg-[var(--color-primary-subtle)] text-primary border-[var(--color-border)]",
  supporter:
    "bg-[var(--color-primary-subtle)] text-primary border-[var(--color-border)]",
  aide: "bg-[var(--color-primary-subtle)] text-primary border-[var(--color-border)]",
};

const ROLE_LABELS: Record<string, string> = {
  coordinator: "Coordinator",
  caregiver: "Caregiver",
  supporter: "Supporter",
  aide: "Aide",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  caregiver: "Provides hands-on day-to-day care",
  coordinator: "Manages the care team and has full access",
  supporter: "Family or friend who can read and react to updates",
  aide: "Professional or paid aide with caregiver-level access",
};

export function TeamPanel({
  members,
  currentUserId,
  canInvite,
  onInvite,
  showInvite,
  onToggleInvite,
}: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("caregiver");
  const [sending, setSending] = useState(false);

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    await onInvite(email.trim(), role);
    setEmail("");
    setRole("caregiver");
    setSending(false);
  }

  return (
    <Card className="gap-2">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">
          {"Care team"}
          <span className="ml-2 text-xs text-[var(--color-muted)] font-normal">
            {members.length}
            {" members"}
          </span>
        </CardTitle>
        {/* Toggle button: visible only on < lg; desktop always shows the form */}
        {canInvite && (
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleInvite}
            className="text-xs lg:hidden"
          >
            {showInvite ? "Cancel" : "Invite someone"}
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {/* Invite form:
            - On mobile (<lg): shown only when showInvite is true
            - On desktop (lg+): always shown via `lg:block`
            Single DOM instance keeps tests and behaviour consistent. */}
        {canInvite && (
          <form
            onSubmit={handleInvite}
            className={
              "px-4 py-3 border-b border-border bg-[var(--color-surface)] " +
              (showInvite ? "block" : "hidden lg:block")
            }
          >
            <p className="text-xs font-medium text-foreground/80 mb-1">
              Invite someone
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              They will receive an invite link to join this care team.
            </p>

            <div className="space-y-2">
              <div>
                <label
                  htmlFor="team-invite-email"
                  className="block text-xs text-muted-foreground mb-1"
                >
                  Email address
                </label>
                <Input
                  id="team-invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  className="text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="team-invite-role"
                  className="block text-xs text-muted-foreground mb-1"
                >
                  Role
                </label>
                <select
                  id="team-invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
                >
                  <option value="caregiver">Caregiver</option>
                  <option value="coordinator">Coordinator</option>
                  <option value="supporter">Supporter</option>
                  <option value="aide">Aide</option>
                </select>
                {role && ROLE_DESCRIPTIONS[role] && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {ROLE_DESCRIPTIONS[role]}
                  </p>
                )}
              </div>
            </div>

            <Separator className="my-3" />

            <Button
              type="submit"
              disabled={sending || !email.trim()}
              className="w-full"
              size="sm"
            >
              {sending ? "Sending..." : "Send invite"}
            </Button>
          </form>
        )}

        <div className="divide-y divide-border">
          {members.map((member) => (
            <div
              key={member.id}
              className="px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-surface)] flex items-center justify-center">
                  <span className="text-xs font-medium text-foreground/80">
                    {(
                      member.display_name?.[0] ??
                      member.email?.[0] ??
                      "?"
                    ).toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-foreground">
                    {member.display_name ?? (member.email ? member.email.split("@")[0] : "Team member")}
                  </span>
                  {member.user_id === currentUserId && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      you
                    </span>
                  )}
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  "capitalize text-xs " + (ROLE_BADGE[member.role] ?? "")
                }
              >
                {ROLE_LABELS[member.role] ?? member.role}
              </Badge>
            </div>
          ))}
          {members.length === 0 && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                No team members yet.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
