"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "../lib/supabase";
import { authenticatedFetch } from "../lib/authenticatedFetch";

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
};

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

  async function loadRecipients(orgId: string) {
    const supabase = createClient();
    // care_recipients has no display_name column — names live in the display_names
    // PHI-vault table (full_name, keyed by recipient_id).
    const { data } = await supabase
      .from("display_names")
      .select("recipient_id, full_name")
      .eq("org_id", orgId)
      .order("full_name", { ascending: true });
    if (data) {
      setRecipients(
        data.map((row) => ({ id: row.recipient_id, display_name: row.full_name })),
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
  };
}
