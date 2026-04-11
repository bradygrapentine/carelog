# Server-Side Auth Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace client-side `useEffect` auth with server component auth guards on all protected pages, eliminating auth flash and enabling SSR.

**Architecture:** Each protected `page.tsx` becomes an async server component that calls `createServerSupabase().auth.getUser()` and redirects unauthenticated users. Client components receive `user` as a guaranteed non-null prop.

**Tech Stack:** Next.js 16 App Router, @supabase/ssr, Vitest

**Spec:** `docs/superpowers/specs/2026-04-10-server-auth-migration-design.md`

---

## File Map

**Modified files:**
- `apps/web/app/(app)/layout.tsx` — server auth, pass user to AppShellClient
- `apps/web/components/app/AppShellClient.tsx` — accept `user` prop, remove useEffect auth
- `apps/web/app/(app)/dashboard/page.tsx` — server auth, pass user to DashboardClient
- `apps/web/app/(app)/dashboard/DashboardClient.tsx` — accept `user` prop, remove useEffect auth
- `apps/web/app/(app)/journal/[recipientId]/page.tsx` — server auth, pass user to JournalClient
- `apps/web/app/(app)/journal/[recipientId]/JournalClient.tsx` — accept `user` prop, remove useEffect auth
- `apps/web/app/(app)/team/admin/page.tsx` — server auth + coordinator guard
- `apps/web/docs/project-info/technology/TECH_DEBT.md` — mark item #1 FIXED

**Test files to update:**
- `apps/web/components/app/__tests__/AppTabBar.test.tsx` — may need prop updates
- `apps/web/app/(app)/dashboard/__tests__/DashboardClient.test.tsx`
- `apps/web/app/(app)/dashboard/__tests__/DashboardClient.flow.test.tsx`
- `apps/web/app/(app)/journal/[recipientId]/__tests__/JournalClient.flow.test.tsx`

---

## Task 1: App Layout + AppShellClient

The `(app)/layout.tsx` wraps all protected pages. Moving auth here means every child page gets auth for free.

**Files:**
- Modify: `apps/web/app/(app)/layout.tsx`
- Modify: `apps/web/components/app/AppShellClient.tsx`

- [ ] **Step 1: Convert layout.tsx to async server component with auth**

```tsx
// apps/web/app/(app)/layout.tsx
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import { AppShellClient } from "../../components/app/AppShellClient";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const email = user.email ?? "";
  const userInitials = email.slice(0, 2).toUpperCase();

  return <AppShellClient userInitials={userInitials}>{children}</AppShellClient>;
}
```

- [ ] **Step 2: Remove auth from AppShellClient — accept userInitials as prop**

```tsx
// apps/web/components/app/AppShellClient.tsx
"use client";

import { createClient } from "@/lib/supabase";
import { AppTabBar } from "./AppTabBar";

type Props = {
  userInitials: string;
  children: React.ReactNode;
};

export function AppShellClient({ userInitials, children }: Props) {
  function handleSignOut() {
    const supabase = createClient();
    supabase.auth.signOut().then(() => {
      window.location.href = "/signin";
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-surface)]">
      <AppTabBar userInitials={userInitials} onSignOut={handleSignOut} />
      <main role="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
```

Key changes:
- Remove `useEffect`, `useState`, `createClient` auth check
- Accept `userInitials` as prop (computed by server layout)
- Keep `handleSignOut` (needs browser client for sign-out)
- Keep `createClient` import for sign-out only

- [ ] **Step 3: Run tests**

Run: `pnpm test`
Expected: All pass (AppTabBar tests already pass `userInitials` as prop)

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/layout.tsx apps/web/components/app/AppShellClient.tsx
git commit -m "refactor(auth): server-side auth in app layout + AppShellClient"
```

---

## Task 2: Dashboard

**Files:**
- Modify: `apps/web/app/(app)/dashboard/page.tsx`
- Modify: `apps/web/app/(app)/dashboard/DashboardClient.tsx`
- Modify: `apps/web/app/(app)/dashboard/__tests__/DashboardClient.test.tsx`
- Modify: `apps/web/app/(app)/dashboard/__tests__/DashboardClient.flow.test.tsx`

- [ ] **Step 1: Convert dashboard page.tsx to server component**

```tsx
// apps/web/app/(app)/dashboard/page.tsx
import { createServerSupabase } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import { ErrorBoundary } from "../../../components/ErrorBoundary";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  return (
    <ErrorBoundary>
      <DashboardClient user={user} />
    </ErrorBoundary>
  );
}
```

- [ ] **Step 2: Refactor DashboardClient to accept user prop**

Read `apps/web/app/(app)/dashboard/DashboardClient.tsx` and make these changes:

1. Change the function signature:
```tsx
// OLD
export function DashboardClient() {
  const [user, setUser] = useState<User | null>(null);
```
to:
```tsx
// NEW
type Props = {
  user: User;
};

export function DashboardClient({ user }: Props) {
```

2. Remove the entire auth `useEffect` (lines 19-121) and replace with a data-loading `useEffect`:
```tsx
useEffect(() => {
  async function loadTeams() {
    // Pending invite bridge
    const pendingInvite = sessionStorage.getItem("pending_invite");
    if (pendingInvite) {
      sessionStorage.removeItem("pending_invite");
      window.location.href = "/invite/" + pendingInvite;
      return;
    }

    // Pending billing bridge
    const pendingPlan = sessionStorage.getItem("pendingPlan");
    if (pendingPlan) {
      sessionStorage.removeItem("pendingPlan");
      try {
        const { interval } = JSON.parse(pendingPlan);
        const supabase = createClient();
        const { data: memberships } = await supabase
          .from("memberships")
          .select("org_id")
          .eq("user_id", user.id)
          .not("accepted_at", "is", null)
          .limit(1);

        if (memberships && memberships[0]) {
          const res = await fetch("/api/stripe/checkout", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              orgId: memberships[0].org_id,
              interval: interval ?? "month",
            }),
          });
          if (res.ok) {
            const { url } = await res.json();
            window.location.href = url;
            return;
          }
        }
      } catch {
        // If checkout fails, continue to dashboard normally
      }
    }

    // Load care teams
    const supabase = createClient();
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
  }

  loadTeams();
}, [user.id]);
```

3. Remove the `if (!user) return null;` guard — `user` is always defined.

4. Remove the `setUser(user)` call — no longer needed.

5. Update the nav bar section — remove the sign-out button (it's in AppShellClient now via AppTabBar):
```tsx
<nav className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
  <span className="font-semibold text-foreground">Carelog</span>
  <span className="text-sm text-muted-foreground">{user.email}</span>
</nav>
```

- [ ] **Step 3: Update DashboardClient tests**

In `DashboardClient.test.tsx` and `DashboardClient.flow.test.tsx`:
- Remove any mock of `createClient().auth.getUser()`
- Pass `user` prop directly: `<DashboardClient user={{ id: 'user-1', email: 'test@example.com' } as any} />`
- Remove tests for "redirects to /signin when not authenticated" (server handles this now)
- Keep tests for team rendering, empty state, pending invite bridge

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test
git add "apps/web/app/(app)/dashboard/"  apps/web/app/\(app\)/dashboard/
git commit -m "refactor(auth): server-side auth for dashboard — user as prop"
```

---

## Task 3: Journal

**Files:**
- Modify: `apps/web/app/(app)/journal/[recipientId]/page.tsx`
- Modify: `apps/web/app/(app)/journal/[recipientId]/JournalClient.tsx`
- Modify: `apps/web/app/(app)/journal/[recipientId]/__tests__/JournalClient.flow.test.tsx`

- [ ] **Step 1: Convert journal page.tsx to server component**

```tsx
// apps/web/app/(app)/journal/[recipientId]/page.tsx
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import { ErrorBoundary } from "../../../../components/ErrorBoundary";
import { JournalClient } from "./JournalClient";

export default async function JournalPage({
  params,
}: Readonly<{
  params: Promise<{ recipientId: string }>;
}>) {
  const { recipientId } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  return (
    <ErrorBoundary>
      <Suspense>
        <JournalClient recipientId={recipientId} user={user} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

Note: This is now a server component — remove `'use client'` directive and `use()` call. Use `await params` instead.

- [ ] **Step 2: Refactor JournalClient to accept user prop**

In `JournalClient.tsx`:

1. Change props type and signature:
```tsx
// OLD
interface Props {
  recipientId: string;
}
export function JournalClient({ recipientId }: Props) {
  const [user, setUser] = useState<User | null>(null);
```
to:
```tsx
// NEW
type Props = {
  recipientId: string;
  user: User;
};
export function JournalClient({ recipientId, user }: Props) {
```

2. Remove `useState<User | null>(null)` for user.

3. Replace the auth `useEffect` (lines 91-121) with a data-loading `useEffect` that skips the auth check:
```tsx
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
```

4. Remove `setUser(user)` call.

5. Remove `if (!user) { window.location.href = "/signin"; return; }` block.

6. Update any `if (!user || !org)` guards to `if (!org)` (user is always defined).

7. Keep the `createClient()` import — still needed for RLS-scoped data queries and sign-out.

- [ ] **Step 3: Update JournalClient flow tests**

In `JournalClient.flow.test.tsx`:
- Pass `user` prop: `<JournalClient recipientId="test-id" user={{ id: 'user-1', email: 'test@test.com' } as any} />`
- Remove mock of `createClient().auth.getUser()`
- Remove "auth failure redirects to signin" test
- Keep all panel routing and data rendering tests

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test
git add "apps/web/app/(app)/journal/[recipientId]/"
git commit -m "refactor(auth): server-side auth for journal — user as prop"
```

---

## Task 4: Team Admin

**Files:**
- Modify: `apps/web/app/(app)/team/admin/page.tsx`

- [ ] **Step 1: Read the full file**

Read: `apps/web/app/(app)/team/admin/page.tsx`

- [ ] **Step 2: Split into server page + client component**

The team admin page has both auth + role checking AND interactive member management. Split it:

Create a wrapper that does server auth + coordinator role check in the page, then passes data to a client component.

The server page.tsx:
```tsx
// apps/web/app/(app)/team/admin/page.tsx
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import { TeamAdminClient } from "./TeamAdminClient";

export default async function TeamAdminPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  // Check coordinator role
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .single();

  if (!membership || membership.role !== "coordinator") {
    redirect("/dashboard");
  }

  return <TeamAdminClient orgId={membership.org_id} userId={user.id} />;
}
```

Move all the existing client-side rendering logic into `TeamAdminClient.tsx`:
- Create: `apps/web/app/(app)/team/admin/TeamAdminClient.tsx`
- Move the member list, remove/role-change handlers, and rendering from the current `page.tsx`
- Accept `orgId` and `userId` as props
- Remove the `useEffect` auth+role check
- Keep the data-loading `useEffect` that fetches members by `orgId`

- [ ] **Step 3: Update the existing team admin test**

In `apps/web/app/(app)/team/admin/__tests__/page.test.tsx`:
- Update import to test `TeamAdminClient` directly
- Pass `orgId` and `userId` as props instead of mocking auth

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test
git add "apps/web/app/(app)/team/admin/"
git commit -m "refactor(auth): server-side auth for team admin — coordinator guard in server component"
```

---

## Task 5: Update TECH_DEBT.md + CLAUDE.md

**Files:**
- Modify: `docs/project-info/technology/TECH_DEBT.md`
- Modify: `apps/web/CLAUDE.md`

- [ ] **Step 1: Mark tech debt #1 as FIXED**

In `TECH_DEBT.md`, change item #1's heading to `### ~~1. Auth is client-side only~~ FIXED` and add a note:

```
Server-side auth migrated. All protected pages use `createServerSupabase().auth.getUser()` in server components. Client components receive `user` as a non-null prop. The `(app)/layout.tsx` provides auth for the entire app shell.
```

- [ ] **Step 2: Update CLAUDE.md auth pattern**

In `apps/web/CLAUDE.md`, update the "Auth pattern — IMPORTANT" section:

```
## Auth pattern — IMPORTANT
Auth is server-side in production. Protected pages use `createServerSupabase().auth.getUser()` 
in server components and pass `user` as a prop to client components.

Client components that need Supabase for data queries still use `createClient()` (browser) 
for RLS-scoped reads and mutations.

Use API routes (not server actions) for any operation writing cookies + redirecting.
```

- [ ] **Step 3: Also update tech debt #14**

In item #14, remove the mentions of "sentry.client.config.ts missing" and "posthog-js not installed" — both are now fixed. Keep the Stripe mention.

- [ ] **Step 4: Commit**

```bash
git add docs/project-info/technology/TECH_DEBT.md apps/web/CLAUDE.md
git commit -m "docs: mark server-side auth migration complete in TECH_DEBT.md + CLAUDE.md"
```

---

## Self-Review

**Spec coverage:**
- ✅ Dashboard page — Task 2
- ✅ Journal page — Task 3
- ✅ Team admin page — Task 4
- ✅ AppShellClient — Task 1
- ✅ Layout-level auth — Task 1
- ✅ Invite page NOT migrated — correct per spec
- ✅ Auth confirm NOT migrated — correct per spec
- ✅ Subscriptions page — not auth-gated (no useEffect auth in it)
- ✅ TECH_DEBT update — Task 5
- ✅ CLAUDE.md update — Task 5
- ✅ Test updates — Tasks 2, 3, 4

**Placeholder scan:** No TBD/TODO. All code blocks are complete.

**Type consistency:** `User` type from `@supabase/supabase-js` used consistently. Props use `user: User` (non-null). `userInitials: string` passed from layout to AppShellClient.
