"use client";

import { useContext, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { Clock, User as UserIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { HandoffSummary } from "@/components/HandoffSummary";
import { JournalEntryForm } from "./JournalEntryForm";
import { JournalTimeline } from "./JournalTimeline";
import { MoodHeatmap } from "@/components/journal/MoodHeatmap";
import { WeeklyMoodBars } from "@/components/journal/WeeklyMoodBars";
import { FridayExportHint } from "@/components/journal/FridayExportHint";
import type { Mood } from "@/lib/mood";
import { TeamPanel } from "./TeamPanel";
import { ShiftForm } from "./ShiftForm";
import { ShiftsPanel } from "./ShiftsPanel";
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
import { SidebarContext } from "../../../../components/sidebar/SidebarContext";

type OrgInfo = {
  id: string;
  name: string;
};

type JournalEvent = {
  id: string;
  event_type: string;
  entry_kind: string;
  occurred_at: string;
  flagged: boolean;
  actor_id: string;
  payload?: { text?: string; mood?: string };
};

type Member = {
  id: string;
  role: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
};

type Recipient = {
  id: string;
  display_name: string | null;
};

export type LayoutProps = {
  recipientId: string;
  user: User;
  org: OrgInfo | null;
  events: JournalEvent[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  members: Member[];
  recipients?: Recipient[];
  currentUserRole: string;
  posting: boolean;
  showInvite: boolean;
  briefUrl: string | null;
  generatingBrief: boolean;
  pendingQueueDepth: number;
  isOnline: boolean;
  onPost: (text: string, mood: string) => Promise<void>;
  onFlag: (eventId: string, flagged: boolean) => Promise<void>;
  onGenerateBrief: () => Promise<void>;
  onInvite: (
    email: string,
    role: string,
    aideRecipientId?: string | null,
  ) => Promise<void>;
  onToggleInvite: () => void;
  onFlushQueue?: () => void;
};

const DESTINATION_LABELS: Record<string, string> = {
  journal: "Journal",
  medications: "Medications",
  team: "Team",
  shifts: "Shifts",
  documents: "Documents",
  more: "More",
};

export function JournalLayout({
  recipientId,
  user,
  org,
  events,
  onLoadMore,
  hasMore,
  loadingMore,
  members,
  recipients,
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
  const [handoffOpen, setHandoffOpen] = useState(false);
  const sectionLabel = DESTINATION_LABELS[activeDestination] ?? "Journal";

  const searchParams = useSearchParams();
  const useHeatmapSidebar = searchParams?.get("sidebar") === "heatmap";

  // Anchor the 7-day cutoff at mount to keep useMemo pure (Date.now() inside
  // render trips the react-hooks/purity rule under React 19's compiler).
  const [sevenDaysAgo] = useState(() => Date.now() - 7 * 24 * 60 * 60 * 1000);

  const currentRecipient = recipients?.find((r) => r.id === recipientId);

  const moodEntries = useMemo(
    () =>
      events
        .filter(
          (e) =>
            e.entry_kind === "human" && typeof e.payload?.mood === "string",
        )
        .map((e) => ({
          created_at: e.occurred_at,
          mood: (e.payload?.mood ?? null) as Mood | null,
        })),
    [events],
  );

  const weeklyMoodCounts = useMemo(() => {
    let good = 0;
    let steady = 0;
    let difficult = 0;
    for (const e of moodEntries) {
      if (!e.mood) continue;
      const ts = Date.parse(e.created_at);
      if (Number.isNaN(ts) || ts < sevenDaysAgo) continue;
      if (e.mood === "good") good += 1;
      else if (e.mood === "okay") steady += 1;
      else if (e.mood === "difficult") difficult += 1;
    }
    return [
      { mood: "good" as const, count: good },
      { mood: "steady" as const, count: steady },
      { mood: "difficult" as const, count: difficult },
    ];
  }, [moodEntries, sevenDaysAgo]);

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
              {currentRecipient?.display_name ?? org?.name ?? "Care Journal"}
            </span>
            <span className="text-[var(--color-muted)] text-xs hidden sm:inline">
              {sectionLabel}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/recipient/${recipientId}/profile`}
              className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 transition-colors"
              aria-label="View recipient profile"
            >
              <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Profile</span>
            </Link>
            <button
              type="button"
              onClick={() => setHandoffOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 transition-colors"
              aria-label="What did I miss? — open handoff summary"
            >
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">What did I miss?</span>
            </button>
            <span className="text-xs text-[var(--color-muted)] hidden sm:inline">
              {(user.user_metadata?.display_name as string | undefined) ??
                user.email}
            </span>
          </div>
        </header>

        <HandoffSummary
          open={handoffOpen}
          onClose={() => setHandoffOpen(false)}
          recipientId={recipientId}
        />

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
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="min-w-0 space-y-4">
                  <JournalTimeline
                    events={events}
                    currentUserId={user.id}
                    canFlag={currentUserRole !== "supporter"}
                    recipientId={recipientId}
                    onFlag={onFlag}
                    members={members}
                    onLoadMore={onLoadMore}
                    hasMore={hasMore}
                    loadingMore={loadingMore}
                  />
                </div>
                <aside
                  aria-label="Mood overview"
                  className="hidden lg:block lg:sticky lg:top-[68px] lg:self-start space-y-4"
                >
                  {useHeatmapSidebar ? (
                    <MoodHeatmap entries={moodEntries} />
                  ) : (
                    <WeeklyMoodBars counts={weeklyMoodCounts} />
                  )}
                  <FridayExportHint />
                </aside>
              </div>
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
                recipients={recipients}
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
              <ShiftsPanel
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
                      <div className="mt-2 flex items-start gap-2">
                        <p className="text-xs text-[var(--color-muted)] break-all flex-1">
                          {briefUrl}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(briefUrl);
                            toast.success("Link copied");
                          }}
                          className="shrink-0 text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 rounded"
                        >
                          Copy link
                        </button>
                      </div>
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
