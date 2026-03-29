"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase";
import type { User } from "@supabase/supabase-js";

interface CareTeam {
  org: { id: string; name: string };
  recipientId: string;
}

export function DashboardClient() {
  const [user, setUser] = useState<User | null>(null);
  const [teams, setTeams] = useState<CareTeam[]>([]);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  // createClient() is the browser Supabase client (anon key).
  // We use client-side auth here instead of a server component because in local
  // dev the session cookie name (sb-127-auth-token) doesn't match what
  // @supabase/ssr expects. This resolves automatically on Supabase Cloud.
  const supabase = createClient()

  supabase.auth.getUser().then(async ({ data: { user } }) => {
    if (!user) { window.location.href = '/signin'; return }
    setUser(user)

    // Pending invite bridge: when a user visits /invite/TOKEN while not signed in,
    // the token is saved to sessionStorage before they're redirected to /signin.
    // After sign-in always lands here (/dashboard), we check for that saved token
    // and immediately bounce them back to their invite URL to complete acceptance.
    const pendingInvite = sessionStorage.getItem('pending_invite')
    if (pendingInvite) {
      sessionStorage.removeItem('pending_invite')
      // window.location.href (hard navigate) ensures the session cookie is read
      // fresh on the invite page. router.push() could miss it.
      window.location.href = '/invite/' + pendingInvite
      return
    }

      // Only fetch accepted (active) memberships — pending invites have accepted_at = null.
      const { data: memberships } = await supabase
        .from("memberships")
        .select("org_id, recipient_id, organizations(id, name)")
        .eq("user_id", user.id)
        .not("accepted_at", "is", null);

      type Membership = {
        org_id: string;
        recipient_id: string;
        organizations: { id: string; name: string } | null;
      };

      if (memberships) {
        const seen = new Set<string>();
        const result: CareTeam[] = [];

        for (const m of memberships as unknown as Membership[]) {
          const org = m.organizations;
          if (!org || seen.has(org.id)) continue;
          seen.add(org.id);

          // Each org can have multiple recipients (agency model), but for
          // family use we only need the first one to navigate to the journal.
          const { data: recipients } = await supabase
            .from("care_recipients")
            .select("id")
            .eq("org_id", org.id)
            .limit(1);

          if (recipients?.[0]) {
            result.push({ org, recipientId: recipients[0].id });
          }
        }
        setTeams(result);
      }

      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-900">Carelog</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user.email}</span>
          <button
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              window.location.href = "/signin";
            }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Your care teams
        </h1>
        <p className="text-gray-600 mb-8">
          Coordinate care, track medications, and support your team.
        </p>

        {teams.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-xl p-8 shadow-sm text-center">
            <p className="text-gray-500 text-sm mb-6">
              You do not have any care teams yet. Set one up to get started.
            </p>
            <a
              href="/onboarding"
              className="inline-block px-6 py-3 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Set up a care team
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {teams.map((team) => (
              <button
                key={team.org.id}
                onClick={() => {
                  // Hard navigate so the session cookie is always fresh on the journal page.
                  window.location.href = "/journal/" + team.recipientId;
                }}
                className="w-full text-left bg-white border border-gray-100 rounded-xl p-6 shadow-sm hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">
                      {team.org.name}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      View care journal
                    </p>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            ))}
            <a
              href="/onboarding"
              className="block text-center text-sm text-gray-500 hover:text-gray-700 py-2"
            >
              Add another care team
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
