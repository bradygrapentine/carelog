"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "../../../../lib/supabase";
import { authenticatedFetch } from "../../../../lib/authenticatedFetch";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { useOnlineStatus } from "../../../../hooks/useOnlineStatus";
import {
  clearAll as clearOfflineQueue,
  getAll,
  getDeadLetters,
  markAttempt,
  pushEntry,
  queueDepth,
  QueueFullError,
  removeEntry,
} from "../../../../lib/offline-queue";
import { Card, CardContent } from "@/components/ui/card";
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
import { BurnoutOrgSummary } from "./BurnoutOrgSummary";
import { ExpensePanel } from "./ExpensePanel";
import { ExportButton } from "./ExportButton";
import { BenefitsNavigator } from "./BenefitsNavigator";
import { DocumentVault } from "./DocumentVault";
import { EolPlanner } from "./EolPlanner";
import {
  SidebarContext,
  SidebarProvider,
} from "../../../../components/sidebar/SidebarContext";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  recipientId: string;
  user: User;
};
type OrgInfo = {
  id: string;
  name: string;
};
type Member = {
  id: string;
  role: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
};
type JournalEvent = {
  id: string;
  event_type: string;
  entry_kind: string;
  occurred_at: string;
  flagged: boolean;
  payload?: { text?: string; mood?: string };
};

const VALID_PANELS = [
  "journal",
  "medications",
  "team",
  "shifts",
  "documents",
  "more",
] as const;
type ValidPanel = (typeof VALID_PANELS)[number];

export function JournalClient({ recipientId, user }: Props) {
  const searchParams = useSearchParams();
  const panelParam = searchParams?.get("panel") ?? null;
  const defaultPanel: ValidPanel = (VALID_PANELS as readonly string[]).includes(
    panelParam ?? "",
  )
    ? (panelParam as ValidPanel)
    : "journal";

  const { isOnline } = useOnlineStatus();
  const prevOnlineRef = useRef<boolean>(isOnline);

  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [events, setEvents] = useState<JournalEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>("supporter");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [briefUrl, setBriefUrl] = useState<string | null>(null);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [pendingQueueDepth, setPendingQueueDepth] = useState(0);

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
    async function loadData() {
      const supabase = createClient();
      const { data: recipient } = await supabase
        .from("care_recipients")
        .select("org_id, organizations(id, name)")
        .eq("id", recipientId)
        .single();
      if (recipient) {
        const orgData = (recipient as unknown as { organizations: OrgInfo })
          .organizations;
        setOrg(orgData);
        await loadMembers(orgData.id, user.id);
      }
      await loadEvents();
      setLoading(false);
    }
    loadData();
  }, [recipientId, user.id]);

  const refreshQueueDepth = useCallback(async () => {
    const depth = await queueDepth();
    setPendingQueueDepth(depth);
  }, []);

  const flushQueue = useCallback(
    async (orgId: string) => {
      const all = await getAll();
      const pending = all.filter((e) => e.attempts < 3);
      if (pending.length === 0) return;

      let flushedCount = 0;
      for (const entry of pending) {
        try {
          await authenticatedFetch("/api/journal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipientId: entry.recipientId,
              orgId,
              text: entry.payload.text,
              mood: entry.payload.mood,
              clientId: entry.id,
            }),
          });
          await removeEntry(entry.id);
          flushedCount++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          await markAttempt(entry.id, msg);
        }
      }

      if (flushedCount > 0) {
        await loadEvents();
        toast.success(
          `Synced ${flushedCount} queued ${flushedCount === 1 ? "entry" : "entries"}`,
        );
      }

      const dead = await getDeadLetters();
      if (dead.length > 0) {
        toast.error(
          `${dead.length} ${dead.length === 1 ? "entry" : "entries"} failed to sync after 3 attempts`,
        );
      }

      await refreshQueueDepth();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshQueueDepth],
  );

  async function handlePost(text: string, mood: string) {
    if (!org) return;

    if (!isOnline) {
      try {
        await pushEntry({
          id: crypto.randomUUID(),
          orgId: org.id,
          recipientId,
          createdAt: new Date().toISOString(),
          payload: { text, mood: mood || undefined },
        });
        await refreshQueueDepth();
        toast.success("Saved locally — will sync when back online");
      } catch (e) {
        if (e instanceof QueueFullError) {
          toast.error(
            "Offline queue is full. Connect to the internet to sync.",
          );
        }
      }
      return;
    }

    setPosting(true);
    const clientId = crypto.randomUUID();
    try {
      await authenticatedFetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId,
          orgId: org.id,
          text,
          mood: mood || undefined,
          clientId,
        }),
      });
      // Full reload after POST rather than optimistic update. The server is the
      // source of truth for occurred_at and the generated payload shape.
      await loadEvents();
    } finally {
      setPosting(false);
    }
  }

  // Refresh queue depth on mount
  useEffect(() => {
    refreshQueueDepth();
  }, [refreshQueueDepth]);

  // Flush queue when coming back online
  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    prevOnlineRef.current = isOnline;
    if (isOnline && wasOffline && org) {
      flushQueue(org.id);
    }
  }, [isOnline, org, flushQueue]);

  async function handleFlag(eventId: string, flagged: boolean) {
    await authenticatedFetch("/api/journal/" + eventId + "/flag", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagged, userId: user.id }),
    });
    // Update local state directly — avoids a full reload for a single boolean toggle
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, flagged } : e)),
    );
  }

  async function handleGenerateBrief() {
    if (!org) return;
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
    if (!org) return;
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
      <div className="min-h-screen bg-[var(--color-surface)]">
        <div className="max-w-2xl lg:max-w-6xl w-full mx-auto px-4 lg:px-8 py-6 space-y-4">
          <Skeleton className="h-5 w-40 rounded" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-5/6 rounded" />
          </div>
        </div>
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
        pendingQueueDepth={pendingQueueDepth}
        isOnline={isOnline}
        onPost={handlePost}
        onFlag={handleFlag}
        onGenerateBrief={handleGenerateBrief}
        onInvite={handleInvite}
        onToggleInvite={() => setShowInvite((v) => !v)}
        onFlushQueue={org ? () => flushQueue(org.id) : undefined}
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
  user: User;
  org: OrgInfo | null;
  events: JournalEvent[];
  members: Member[];
  currentUserRole: string;
  posting: boolean;
  showInvite: boolean;
  briefUrl: string | null;
  generatingBrief: boolean;
  pendingQueueDepth: number;
  isOnline: boolean;
  onPost: (text: string, mood: string) => Promise<void>;
  onFlag: (eventId: string, flagged: boolean) => void;
  onGenerateBrief: () => Promise<void>;
  onInvite: (email: string, role: string) => Promise<void>;
  onToggleInvite: () => void;
  onFlushQueue?: () => void;
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
  pendingQueueDepth,
  isOnline,
  onPost,
  onFlag,
  onGenerateBrief,
  onInvite,
  onToggleInvite,
  onFlushQueue,
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
            {user.email}
          </span>
        </header>

        {/* Panel content */}
        <main className="flex-1 max-w-2xl lg:max-w-6xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
          {activeDestination === "journal" && (
            <>
              {isOnline && pendingQueueDepth > 0 && (
                <div
                  role="status"
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-primary-subtle)] px-4 py-2 text-sm"
                >
                  <span className="text-[var(--color-text-secondary)]">
                    {pendingQueueDepth} unsent{" "}
                    {pendingQueueDepth === 1 ? "entry" : "entries"} queued
                    offline
                  </span>
                  <button
                    type="button"
                    onClick={onFlushQueue}
                    className="font-medium text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 rounded"
                  >
                    Sync now
                  </button>
                </div>
              )}
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
                currentUserId={user.id}
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
                currentUserId={user.id}
                canInvite={currentUserRole === "coordinator"}
                onInvite={onInvite}
                showInvite={showInvite}
                onToggleInvite={onToggleInvite}
                orgId={org?.id}
                canRemove={currentUserRole === "coordinator"}
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
                currentUserId={user.id}
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
                  <BurnoutOrgSummary
                    orgId={org.id}
                    currentUserRole={currentUserRole}
                  />
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
                  <Card className="border-border">
                    <CardContent className="pt-4 space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        Settings
                      </p>
                      <a
                        href="/billing"
                        className="block text-sm text-primary hover:text-primary/80 transition-colors"
                      >
                        Billing & subscription
                      </a>
                      <a
                        href="/team/admin"
                        className="block text-sm text-primary hover:text-primary/80 transition-colors"
                      >
                        Team admin
                      </a>
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
