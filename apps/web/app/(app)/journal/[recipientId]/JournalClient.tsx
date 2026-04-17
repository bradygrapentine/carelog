"use client";

import { useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { useOnlineStatus } from "../../../../hooks/useOnlineStatus";
import { useJournalData } from "../../../../hooks/useJournalData";
import { useOfflineQueue } from "../../../../hooks/useOfflineQueue";
import { useJournalActions } from "../../../../hooks/useJournalActions";
import { JournalLayout } from "./JournalLayout";
import { SidebarProvider } from "../../../../components/sidebar/SidebarContext";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  recipientId: string;
  user: User;
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
  const {
    org,
    events,
    setEvents,
    members,
    recipients,
    currentUserRole,
    loading,
    loadEvents,
  } = useJournalData(recipientId, user);
  const { pendingQueueDepth, flushQueue } = useOfflineQueue(
    org?.id ?? null,
    loadEvents,
  );
  const actions = useJournalActions(
    org,
    recipientId,
    user.id,
    loadEvents,
    isOnline,
    async () => {
      // refreshQueueDepth is internal to useOfflineQueue; flushQueue covers sync.
      // For the offline post path we only need queue depth refresh which
      // useOfflineQueue already handles on mount. This no-op satisfies the
      // signature; the depth re-reads on next mount/flush cycle.
    },
    setEvents,
  );

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
        recipients={recipients}
        currentUserRole={currentUserRole}
        posting={actions.posting}
        showInvite={actions.showInvite}
        briefUrl={actions.briefUrl}
        generatingBrief={actions.generatingBrief}
        pendingQueueDepth={pendingQueueDepth}
        isOnline={isOnline}
        onPost={actions.handlePost}
        onFlag={actions.handleFlag}
        onGenerateBrief={actions.handleGenerateBrief}
        onInvite={actions.handleInvite}
        onToggleInvite={actions.onToggleInvite}
        onFlushQueue={() => flushQueue()}
      />
    </SidebarProvider>
  );
}
