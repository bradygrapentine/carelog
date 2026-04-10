"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase";
import { authenticatedFetch } from "../../../lib/authenticatedFetch";
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

export function JournalClient({ recipientId }: Props) {
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </a>
          <span className="font-semibold text-gray-900">
            {org?.name ?? "Care Journal"}
          </span>
        </div>
        <span className="text-sm text-gray-500">{user?.email}</span>
      </nav>

      <div className="max-w-2xl mx-auto py-8 px-4">
        {currentUserRole !== "supporter" ? (
          <JournalEntryForm onPost={handlePost} posting={posting} />
        ) : (
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-4 py-3">
            <p className="text-sm text-gray-500">
              You&apos;re here as a Supporter — you can read everything shared
              and react to entries.
            </p>
          </div>
        )}
        <div className="mt-6">
          <TeamPanel
            members={members}
            currentUserId={user?.id ?? ""}
            canInvite={currentUserRole === "coordinator"}
            onInvite={handleInvite}
            showInvite={showInvite}
            onToggleInvite={() => setShowInvite((v) => !v)}
          />
        </div>
        {currentUserRole === "coordinator" && org && (
          <div className="mt-6">
            <ShiftForm
              members={members}
              recipientId={recipientId}
              orgId={org.id}
              onSuccess={() => {}}
            />
          </div>
        )}
        <div className="mt-6">
          <ShiftList
            orgId={org?.id ?? ""}
            recipientId={recipientId}
            members={members}
            currentUserId={user?.id ?? ""}
            currentUserRole={currentUserRole}
          />
        </div>
        {currentUserRole === "coordinator" && org && (
          <div className="mt-6">
            <OuterCirclePanel
              recipientId={recipientId}
              orgId={org.id}
              currentUserRole={currentUserRole}
            />
          </div>
        )}
        <div className="mt-6">
          <MedicationPanel
            orgId={org?.id ?? ""}
            recipientId={recipientId}
            currentUserRole={currentUserRole}
          />
        </div>
        <div className="mt-6">
          <MedicationChecklist
            orgId={org?.id ?? ""}
            recipientId={recipientId}
            currentUserRole={currentUserRole}
          />
        </div>
        <div className="mt-6">
          <SymptomPanel
            orgId={org?.id ?? ""}
            recipientId={recipientId}
            currentUserRole={currentUserRole}
          />
        </div>
        <div className="mt-6">
          <BurnoutCheckin
            orgId={org?.id ?? ""}
            currentUserRole={currentUserRole}
            currentUserId={user?.id ?? ""}
          />
        </div>
        <div className="mt-6">
          <ExpensePanel
            orgId={org?.id ?? ""}
            recipientId={recipientId}
            currentUserRole={currentUserRole}
          />
        </div>
        {currentUserRole === "coordinator" && org && (
          <div className="mt-6">
            <ExportButton
              orgId={org.id}
              recipientId={recipientId}
              currentUserRole={currentUserRole}
            />
          </div>
        )}
        {currentUserRole === "coordinator" && org && (
          <div className="mt-6">
            <BenefitsNavigator
              orgId={org.id}
              recipientId={recipientId}
              currentUserRole={currentUserRole}
            />
          </div>
        )}
        <div className="mt-6">
          <DocumentVault
            orgId={org?.id ?? ""}
            recipientId={recipientId}
            currentUserRole={currentUserRole}
          />
        </div>
        {currentUserRole === "coordinator" && org && (
          <div className="mt-6">
            <EolPlanner
              orgId={org.id}
              recipientId={recipientId}
              currentUserRole={currentUserRole}
            />
          </div>
        )}
        {currentUserRole === "coordinator" && org && (
          <div className="mt-6">
            <OcrReviewPanel orgId={org.id} recipientId={recipientId} />
          </div>
        )}
        {currentUserRole === "coordinator" && (
          <div className="mt-6">
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-4 py-3">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Care brief
              </p>
              <button
                type="button"
                onClick={handleGenerateBrief}
                disabled={generatingBrief}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                {generatingBrief ? "Generating..." : "Generate shareable brief"}
              </button>
              {briefUrl && (
                <p className="text-xs text-gray-500 mt-2 break-all">
                  {briefUrl}
                </p>
              )}
            </div>
          </div>
        )}
        <div className="mt-6">
          <JournalTimeline
            events={events}
            currentUserId={user?.id ?? ""}
            canFlag={currentUserRole !== "supporter"}
            recipientId={recipientId}
            onFlag={handleFlag}
          />
        </div>
      </div>
    </div>
  );
}
