"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { createClient } from "../lib/supabase";
import { authenticatedFetch } from "../lib/authenticatedFetch";
import type { JournalEvent } from "@/types/journal";

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

type Recipient = {
  id: string;
  display_name: string | null;
};

type UseJournalDataReturn = {
  org: OrgInfo | null;
  events: JournalEvent[];
  setEvents: React.Dispatch<React.SetStateAction<JournalEvent[]>>;
  members: Member[];
  recipients: Recipient[];
  currentUserRole: string;
  loading: boolean;
  loadEvents: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  loadingMore: boolean;
};

const PAGE_LIMIT = 50;

export function useJournalData(
  recipientId: string,
  user: User,
): UseJournalDataReturn {
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [events, setEvents] = useState<JournalEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>("supporter");
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadEvents() {
    const res = await authenticatedFetch(
      `/api/journal?recipientId=${recipientId}&limit=${PAGE_LIMIT}`,
    );
    const data = await res.json();
    if (data.events) {
      setEvents(data.events);
      setHasMore(Boolean(data.hasMore));
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore || events.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = events[events.length - 1];
      const res = await authenticatedFetch(
        `/api/journal?recipientId=${recipientId}&before=${encodeURIComponent(
          oldest.occurred_at,
        )}&limit=${PAGE_LIMIT}`,
      );
      const data = await res.json();
      if (data.events) {
        setEvents((prev) => [...prev, ...data.events]);
        setHasMore(Boolean(data.hasMore));
      }
    } finally {
      setLoadingMore(false);
    }
  }

  async function loadMembers(orgId: string, userId: string) {
    const res = await authenticatedFetch("/api/members?orgId=" + orgId);
    if (!res.ok) {
      // Previously silent: a failed request left members stale and the current
      // user's role unset. Surface it; generic message (no member PHI).
      toast.error("Couldn't load the care team — please refresh.");
      return;
    }
    const data = await res.json();
    if (data.members) {
      setMembers(data.members);
      const me = data.members.find((m: Member) => m.user_id === userId);
      if (me) setCurrentUserRole(me.role);
    }
  }

  async function loadRecipients(orgId: string) {
    const supabase = createClient();
    // care_recipients has no display_name column — names live in the display_names
    // PHI-vault table (full_name, keyed by recipient_id).
    const { data, error } = await supabase
      .from("display_names")
      .select("recipient_id, full_name")
      .eq("org_id", orgId)
      .order("full_name", { ascending: true });
    if (error) {
      // Generic message only — display_names.full_name is PHI, never logged/echoed.
      toast.error("Couldn't load recipients — please refresh.");
      return;
    }
    if (data) {
      setRecipients(
        data.map((row) => ({
          id: row.recipient_id,
          display_name: row.full_name,
        })),
      );
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
        await Promise.all([
          loadMembers(orgData.id, user.id),
          loadRecipients(orgData.id),
        ]);
      }
      await loadEvents();
      setLoading(false);
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientId, user.id]);

  return {
    org,
    events,
    setEvents,
    members,
    recipients,
    currentUserRole,
    loading,
    loadEvents,
    loadMore,
    hasMore,
    loadingMore,
  };
}
