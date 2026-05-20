"use client";

import { useState } from "react";
import { toast } from "sonner";
import { authenticatedFetch } from "../lib/authenticatedFetch";
import { pushEntry, QueueFullError } from "../lib/offline-queue";
import type { JournalEvent } from "@/types/journal";

type OrgInfo = {
  id: string;
  name: string;
};

export function useJournalActions(
  org: OrgInfo | null,
  recipientId: string,
  userId: string,
  loadEvents: () => Promise<void>,
  isOnline: boolean,
  refreshQueueDepth: () => Promise<void>,
  setEvents: React.Dispatch<React.SetStateAction<JournalEvent[]>>,
): {
  posting: boolean;
  showInvite: boolean;
  briefUrl: string | null;
  generatingBrief: boolean;
  handlePost: (text: string, mood: string) => Promise<void>;
  handleFlag: (eventId: string, flagged: boolean) => Promise<void>;
  handleGenerateBrief: () => Promise<void>;
  handleInvite: (
    email: string,
    role: string,
    aideRecipientId?: string | null,
  ) => Promise<void>;
  onToggleInvite: () => void;
} {
  const [posting, setPosting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [briefUrl, setBriefUrl] = useState<string | null>(null);
  const [generatingBrief, setGeneratingBrief] = useState(false);

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
        } else {
          // Previously swallowed silently — the user believed the entry saved.
          // Generic message only: never echo journal text/mood (PHI).
          toast.error("Couldn't save offline — please try again.");
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
      // Full reload after POST — server is source of truth for occurred_at
      await loadEvents();
    } finally {
      setPosting(false);
    }
  }

  async function handleFlag(eventId: string, flagged: boolean) {
    await authenticatedFetch("/api/journal/" + eventId + "/flag", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagged, userId }),
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
      toast.error(
        "Error generating care brief: " + (data.error ?? "Unknown error"),
      );
    }
    setGeneratingBrief(false);
  }

  async function handleInvite(
    email: string,
    role: string,
    aideRecipientId?: string | null,
  ) {
    if (!org) return;
    const effectiveRecipientId =
      role === "aide" && aideRecipientId ? aideRecipientId : recipientId;
    const res = await authenticatedFetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId: org.id,
        recipientId: effectiveRecipientId,
        role,
        email,
      }),
    });
    const data = await res.json();
    if (data.inviteUrl) {
      await navigator.clipboard.writeText(data.inviteUrl);
      toast.success("Invite link copied to clipboard");
      setShowInvite(false);
    } else {
      toast.error("Error: " + (data.error ?? "Something went wrong"));
    }
  }

  function onToggleInvite() {
    setShowInvite((v) => !v);
  }

  return {
    posting,
    showInvite,
    briefUrl,
    generatingBrief,
    handlePost,
    handleFlag,
    handleGenerateBrief,
    handleInvite,
    onToggleInvite,
  };
}
