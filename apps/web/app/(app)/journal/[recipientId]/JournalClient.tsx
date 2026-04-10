"use client";

import { useContext, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "../../../../lib/supabase";
import { authenticatedFetch } from "../../../../lib/authenticatedFetch";
import type { User } from "@supabase/supabase-js";
import { JournalEntryForm } from "./JournalEntryForm";
import { JournalTimeline } from "./JournalTimeline";
import { TeamPanel } from "./TeamPanel";
import { ShiftForm } from "./ShiftForm";
import { ShiftList } from "./ShiftList";
import { MedicationPanel } from "./MedicationPanel";
import { MedicationChecklist } from "./MedicationChecklist";
import { OcrReviewPanel } from "./OcrReviewPanel";
import { OuterCirclePanel } from "./OuterCirclePanel";
import { SymptomPanel } from "./SymptomPanel";
import { BurnoutCheckin } from "./BurnoutCheckin";
import { ExpensePanel } from "./ExpensePanel";
import { ExportButton } from "./ExportButton";
import { BenefitsNavigator } from "./BenefitsNavigator";
import { DocumentVault } from "./DocumentVault";
import { EolPlanner } from "./EolPlanner";
import {
  SidebarContext,
  SidebarProvider,
} from "../../../../components/sidebar/SidebarContext";

interface Props {
  recipientId: string;
}
interface OrgInfo {
  id: string;
  name: string;
}
interface Member {
  id: string;
  role: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
}
interface JournalEvent {
  id: string;
  event_type: string;
  entry_kind: string;
  occurred_at: string;
  flagged: boolean;
  payload?: { text?: string; mood?: string };
}

const VALID_PANELS = ["journal", "medications", "team", "shifts", "documents", "more"] as const;
type ValidPanel = typeof VALID_PANELS[number];

export function JournalClient({ recipientId }: Props) {
  const searchParams = useSearchParams();
  const panelParam = searchParams?.get("panel") ?? null;
  const defaultPanel: ValidPanel = (VALID_PANELS as readonly string[]).includes(panelParam ?? "")
    ? (panelParam as ValidPanel)
    : "journal";

  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [events, setEvents] = useState<JournalEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>("supporter");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [briefUrl, setBriefUrl] = useState<string | null>(null);
  const [generatingBrief, setGeneratingBrief] = useState(false);

  async function loadEvents() {
    const res = await authenticatedFetch(
      "/api/journal?recipientId=" + recipientId,
    );
    const data = await res.json();
    if (data.events) setEvents(data.events);
  }

  async function loadMembers(orgId: string, userId: string) {
    const res = await authenticatedFetch("/api/members?orgId=" + orgId);
    const data = await res.json();
    if (data.members) {
      setMembers(data.members);
      const me = data.members.find((m: Member) => m.user_id === userId);
      if (me) setCurrentUserRole(me.role);
    }
  }

  useEffect(() => {
    // Load sequence: user first (auth gate), then org+members+events.
    // We use the browser client (anon key) for auth and RLS-scoped reads.
    // identity_vault is never queried here — recipient names are resolved
    // server-side via the display_names cache when needed.
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        window.location.href = "/signin";
        return;
      }
      setUser(user);

      // Fetch the recipient's org via a Supabase join.
      // RLS ensures this returns null if the user doesn't have access.
      const { data: recipient } = await supabase
        .from("care_recipients")
        .select("org_id, organizations(id, name)")
        .eq("id", recipientId)
        .single();
      if (recipient) {
        const orgData = (recipient as unknown as { organizations: OrgInfo })
          .organizations;
        setOrg(orgData);
        // Load members and events in sequence (both depend on org being set).
        await loadMembers(orgData.id, user.id);
      }
      await loadEvents();
      setLoading(false);
    });
  }, [recipientId]);

  async function handlePost(text: string, mood: string) {
    if (!user || !org) return;
    setPosting(true);
    await authenticatedFetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientId,
        orgId: org.id,
        text,
        mood: mood || undefined,
      }),
    });
    // Full reload after POST rather than optimistic update. The server is the
    // source of truth for occurred_at and the generated payload shape.
    await loadEvents();
    setPosting(false);
  }

  async function handleFlag(eventId: string, flagged: boolean) {
    await authenticatedFetch("/api/journal/" + eventId + "/flag", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagged, userId: user?.id }),
    });
    // Update local state directly — avoids a full reload for a single boolean toggle
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, flagged } : e)),
    );
  }

  async function handleGenerateBrief() {
    if (!user || !org) return;
    setGeneratingBrief(true);
    setBriefUrl(null);
    const res = await authenticatedFetch("/api/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: org.id, recipient_id: recipientId }),
    });
    const data = await res.json();
    if (data.share_token) {
      const url = window.location.origin + "/brief/" + data.share_token;
      setBriefUrl(url);
    } else {
      alert("Error generating care brief: " + (data.error ?? "Unknown error"));
    }
    setGeneratingBrief(false);
  }

  async function handleInvite(email: string, role: string) {
    if (!user || !org) return;
    const res = await authenticatedFetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: org.id, recipientId, role, email }),
    });
    const data = await res.json();
    if (data.inviteUrl) {
      alert(
        "Invite link — copy and send to " + email + ":\n\n" + data.inviteUrl,
      );
      setShowInvite(false);
    } else {
      alert("Error: " + (data.error ?? "Something went wrong"));
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <SidebarProvider defaultDestination={defaultPanel}>
      <JournalLayout
        recipientId={recipientId}
        user={user}
        org={org}
        events={events}
        members={members}
        currentUserRole={currentUserRole}
        posting={posting}
        showInvite={showInvite}
        briefUrl={briefUrl}
        generatingBrief={generatingBrief}
        onPost={handlePost}
        onFlag={handleFlag}
        onGenerateBrief={handleGenerateBrief}
        onInvite={handleInvite}
        onToggleInvite={() => setShowInvite((v) => !v)}
      />
    </SidebarProvider>
  );
}

const DESTINATION_LABELS: Record<string, string> = {
  journal: "Journal",
  medications: "Medications",
  team: "Team",
  shifts: "Shifts",
  documents: "Documents",
  more: "More",
};

type LayoutProps = {
  recipientId: string;
  user: User | null;
  org: OrgInfo | null;
  events: JournalEvent[];
  members: Member[];
  currentUserRole: string;
  posting: boolean;
  showInvite: boolean;
  briefUrl: string | null;
  generatingBrief: boolean;
  onPost: (text: string, mood: string) => Promise<void>;
  onFlag: (eventId: string, flagged: boolean) => void;
  onGenerateBrief: () => Promise<void>;
  onInvite: (email: string, role: string) => Promise<void>;
  onToggleInvite: () => void;
};

function JournalLayout({
  recipientId,
  user,
  org,
  events,
  members,
  currentUserRole,
  posting,
  showInvite,
  briefUrl,
  generatingBrief,
  onPost,
  onFlag,
  onGenerateBrief,
  onInvite,
  onToggleInvite,
}: LayoutProps) {
  const { activeDestination } = useContext(SidebarContext);
  const sectionLabel = DESTINATION_LABELS[activeDestination] ?? "Journal";

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <div className="flex flex-col min-h-screen">
        {/* Top bar */}
        <header
          data-testid="top-bar"
          className="bg-[var(--color-surface)] border-b border-[var(--color-border)] h-[52px] px-4 flex items-center justify-between sticky top-0 z-30"
        >
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[var(--color-text-primary)] text-sm">
              {org?.name ?? "Care Journal"}
            </span>
            <span className="text-[var(--color-muted)] text-xs hidden sm:inline">
              {sectionLabel}
            </span>
          </div>
          <span className="text-xs text-[var(--color-muted)]">
            {user?.email}
          </span>
        </header>

        {/* Panel content */}
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-6">
          {activeDestination === "journal" && (
            <>
              {currentUserRole !== "supporter" ? (
                <JournalEntryForm onPost={onPost} posting={posting} />
              ) : (
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    You&apos;re here as a Supporter — you can read everything
                    shared and react to entries.
                  </p>
                </div>
              )}
              <JournalTimeline
                events={events}
                currentUserId={user?.id ?? ""}
                canFlag={currentUserRole !== "supporter"}
                recipientId={recipientId}
                onFlag={onFlag}
              />
            </>
          )}

          {activeDestination === "medications" && (
            <>
              <MedicationPanel
                orgId={org?.id ?? ""}
                recipientId={recipientId}
                currentUserRole={currentUserRole}
              />
              <MedicationChecklist
                orgId={org?.id ?? ""}
                recipientId={recipientId}
                currentUserRole={currentUserRole}
              />
            </>
          )}

          {activeDestination === "team" && (
            <>
              <TeamPanel
                members={members}
                currentUserId={user?.id ?? ""}
                canInvite={currentUserRole === "coordinator"}
                onInvite={onInvite}
                showInvite={showInvite}
                onToggleInvite={onToggleInvite}
              />
              {currentUserRole === "coordinator" && org && (
                <OuterCirclePanel
                  recipientId={recipientId}
                  orgId={org.id}
                  currentUserRole={currentUserRole}
                />
              )}
            </>
          )}

          {activeDestination === "shifts" && (
            <>
              {currentUserRole === "coordinator" && org && (
                <ShiftForm
                  members={members}
                  recipientId={recipientId}
                  orgId={org.id}
                  onSuccess={() => {}}
                />
              )}
              <ShiftList
                orgId={org?.id ?? ""}
                recipientId={recipientId}
                members={members}
                currentUserId={user?.id ?? ""}
                currentUserRole={currentUserRole}
              />
            </>
          )}

          {activeDestination === "documents" && (
            <>
              <DocumentVault
                orgId={org?.id ?? ""}
                recipientId={recipientId}
                currentUserRole={currentUserRole}
              />
              {currentUserRole === "coordinator" && org && (
                <OcrReviewPanel orgId={org.id} recipientId={recipientId} />
              )}
            </>
          )}

          {activeDestination === "more" && (
            <>
              <SymptomPanel
                orgId={org?.id ?? ""}
                recipientId={recipientId}
                currentUserRole={currentUserRole}
              />
              <BurnoutCheckin
                orgId={org?.id ?? ""}
                currentUserRole={currentUserRole}
                currentUserId={user?.id ?? ""}
              />
              {currentUserRole === "coordinator" && org && (
                <>
                  <ExpensePanel
                    orgId={org.id}
                    recipientId={recipientId}
                    currentUserRole={currentUserRole}
                  />
                  <EolPlanner
                    orgId={org.id}
                    recipientId={recipientId}
                    currentUserRole={currentUserRole}
                  />
                  <BenefitsNavigator
                    orgId={org.id}
                    recipientId={recipientId}
                    currentUserRole={currentUserRole}
                  />
                  <ExportButton
                    orgId={org.id}
                    recipientId={recipientId}
                    currentUserRole={currentUserRole}
                  />
                  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                      Care brief
                    </p>
                    <button
                      type="button"
                      onClick={onGenerateBrief}
                      disabled={generatingBrief}
                      className="text-sm text-[var(--color-muted)] hover:text-[var(--color-text-secondary)] transition-colors disabled:opacity-50"
                    >
                      {generatingBrief
                        ? "Generating..."
                        : "Generate shareable brief"}
                    </button>
                    {briefUrl && (
                      <p className="text-xs text-[var(--color-muted)] mt-2 break-all">
                        {briefUrl}
                      </p>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
