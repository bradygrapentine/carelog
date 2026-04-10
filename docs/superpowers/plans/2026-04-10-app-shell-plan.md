# App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `(app)` route group — a dark plum top tab bar, auth-gated layout — and migrate the existing dashboard and journal routes into it. Add Team Admin and Subscriptions pages. Reskin the Sign In page with the Violet & Plum palette.

**Architecture:** Next.js `app/(app)/` route group with its own `layout.tsx`. Auth check is client-side (matching the existing DashboardClient pattern — `createClient()` browser in `useEffect`). A new `AppShellClient.tsx` handles auth redirect and renders the `AppTabBar`. The SidebarNav/SidebarRail/SidebarSheet in the journal are replaced by the `AppTabBar`. Existing panel logic is untouched.

**Tech Stack:** Next.js 16 App Router, Tailwind v4, shadcn/ui (Sheet for mobile drawer), `createClient()` (browser Supabase), existing tRPC procedures.

**Prerequisites:** Design system plan must be merged first (color tokens and `RoleBadge` must exist).

---

### Task 1: AppTabBar component

**Files:**
- Create: `apps/web/components/app/AppTabBar.tsx`
- Create: `apps/web/components/app/__tests__/AppTabBar.test.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/components/app/__tests__/AppTabBar.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { AppTabBar } from "../AppTabBar";

describe("AppTabBar", () => {
  it("renders all tab labels", () => {
    render(<AppTabBar activeTab="journal" onTabChange={vi.fn()} userInitials="BG" />);
    expect(screen.getByRole("tab", { name: /journal/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /medications/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /team/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /shifts/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /documents/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /more/i })).toBeInTheDocument();
  });

  it("marks the active tab with aria-selected", () => {
    render(<AppTabBar activeTab="medications" onTabChange={vi.fn()} userInitials="BG" />);
    expect(screen.getByRole("tab", { name: /medications/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /journal/i })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onTabChange when a tab is clicked", () => {
    const onTabChange = vi.fn();
    render(<AppTabBar activeTab="journal" onTabChange={onTabChange} userInitials="BG" />);
    fireEvent.click(screen.getByRole("tab", { name: /team/i }));
    expect(onTabChange).toHaveBeenCalledWith("team");
  });

  it("renders user initials in avatar", () => {
    render(<AppTabBar activeTab="journal" onTabChange={vi.fn()} userInitials="BG" />);
    expect(screen.getByText("BG")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/web && npx vitest run components/app/__tests__/AppTabBar.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create AppTabBar**

Create `apps/web/components/app/AppTabBar.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";

export type AppTab =
  | "journal"
  | "medications"
  | "team"
  | "shifts"
  | "documents"
  | "more";

const TABS: { id: AppTab; label: string; icon: string }[] = [
  { id: "journal",     label: "Journal",     icon: "📋" },
  { id: "medications", label: "Medications", icon: "💊" },
  { id: "team",        label: "Team",        icon: "👥" },
  { id: "shifts",      label: "Shifts",      icon: "📅" },
  { id: "documents",   label: "Documents",   icon: "📁" },
  { id: "more",        label: "More",        icon: "⋯" },
];

type Props = {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  userInitials: string;
  onSignOut?: () => void;
};

export function AppTabBar({ activeTab, onTabChange, userInitials, onSignOut }: Props) {
  return (
    <header className="sticky top-0 z-50 w-full bg-[var(--color-ink)] shadow-md">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <div className="flex items-center gap-2 py-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--color-primary-light)]" aria-hidden="true" />
          <span className="text-sm font-bold text-white">Carelog</span>
        </div>

        {/* Tab list */}
        <nav
          role="tablist"
          aria-label="App navigation"
          className="hidden items-center overflow-x-auto md:flex"
        >
          {TABS.map(({ id, label }) => {
            const isActive = id === activeTab;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={isActive}
                aria-controls={id + "-panel"}
                onClick={() => onTabChange(id)}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-4 py-4 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:ring-inset",
                  isActive
                    ? "border-[var(--color-primary-light)] text-white"
                    : "border-transparent text-violet-300 hover:text-white"
                )}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* User avatar */}
        <button
          onClick={onSignOut}
          aria-label="Sign out"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-semibold text-white transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:ring-offset-1 focus:ring-offset-[var(--color-ink)]"
        >
          {userInitials}
        </button>
      </div>

      {/* Mobile tab strip */}
      <div
        role="tablist"
        aria-label="App navigation"
        className="flex overflow-x-auto border-t border-white/10 md:hidden"
      >
        {TABS.map(({ id, label, icon }) => {
          const isActive = id === activeTab;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={isActive}
              aria-controls={id + "-panel"}
              onClick={() => onTabChange(id)}
              className={cn(
                "flex min-w-[4.5rem] flex-col items-center gap-0.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                isActive
                  ? "border-[var(--color-primary-light)] text-white"
                  : "border-transparent text-violet-300 hover:text-white"
              )}
            >
              <span aria-hidden="true">{icon}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run test**

```bash
cd apps/web && npx vitest run components/app/__tests__/AppTabBar.test.tsx
```

Expected: `4 passed`.

- [ ] **Step 5: Run full suite**

```bash
pnpm test
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/app/
git commit -m "feat(app): AppTabBar component — dark plum, ARIA tab roles, mobile strip"
```

---

### Task 2: App shell layout + migrate dashboard route

**Files:**
- Create: `apps/web/app/(app)/layout.tsx`
- Create: `apps/web/components/app/AppShellClient.tsx`
- Create: `apps/web/app/(app)/dashboard/page.tsx`
- Delete: `apps/web/app/dashboard/page.tsx` (and DashboardClient.tsx — moved)
- Move: `apps/web/app/dashboard/DashboardClient.tsx` → `apps/web/app/(app)/dashboard/DashboardClient.tsx`
- Move: `apps/web/app/dashboard/components/` → `apps/web/app/(app)/dashboard/components/` (if exists)

Note: Route groups don't affect URLs. `/dashboard` still resolves after the move.

- [ ] **Step 1: Create the (app) layout**

Create `apps/web/app/(app)/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { AppShellClient } from "../../components/app/AppShellClient";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShellClient>{children}</AppShellClient>;
}
```

- [ ] **Step 2: Create AppShellClient**

Create `apps/web/components/app/AppShellClient.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { AppTabBar } from "./AppTabBar";
import type { AppTab } from "./AppTabBar";

// AppShellClient handles client-side auth and renders the top tab bar.
// Auth is intentionally client-side to match the existing DashboardClient
// pattern — in local dev the session cookie name doesn't match what
// @supabase/ssr expects; this resolves automatically on Supabase Cloud.
export function AppShellClient({ children }: { children: React.ReactNode }) {
  const [userInitials, setUserInitials] = useState("…");
  const [activeTab, setActiveTab] = useState<AppTab>("journal");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        window.location.href = "/signin";
        return;
      }
      const email = user.email ?? "";
      setUserInitials(email.slice(0, 2).toUpperCase());
    });
  }, []);

  function handleSignOut() {
    const supabase = createClient();
    supabase.auth.signOut().then(() => {
      window.location.href = "/signin";
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-surface)]">
      <AppTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userInitials={userInitials}
        onSignOut={handleSignOut}
      />
      <main id={activeTab + "-panel"} role="tabpanel" className="flex-1">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Move DashboardClient into the (app) group**

```bash
mkdir -p apps/web/app/\(app\)/dashboard
cp apps/web/app/dashboard/DashboardClient.tsx apps/web/app/\(app\)/dashboard/DashboardClient.tsx
```

Check if there is a `components/` subdirectory in dashboard and copy it too:

```bash
ls apps/web/app/dashboard/
```

If `components/` exists: `cp -r apps/web/app/dashboard/components apps/web/app/\(app\)/dashboard/`

- [ ] **Step 4: Create the new dashboard page**

Create `apps/web/app/(app)/dashboard/page.tsx`:

```tsx
import { ErrorBoundary } from "../../../components/ErrorBoundary";
import { DashboardClient } from "./DashboardClient";

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <DashboardClient />
    </ErrorBoundary>
  );
}
```

- [ ] **Step 5: Update DashboardClient imports for its new path**

Open `apps/web/app/(app)/dashboard/DashboardClient.tsx`. The relative imports changed depth — update:

- `"../../lib/supabase"` → `"../../../lib/supabase"`
- Any other `../../` relative imports → `../../../`

Run TypeScript to find all broken imports:

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "dashboard/DashboardClient"
```

Fix all reported import path errors.

- [ ] **Step 6: Delete the old dashboard route**

```bash
rm apps/web/app/dashboard/DashboardClient.tsx
rm apps/web/app/dashboard/page.tsx
rmdir apps/web/app/dashboard/ 2>/dev/null || true
```

- [ ] **Step 7: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Run full suite**

```bash
pnpm test
```

Expected: all passing. (Dashboard tests, if any, resolve via the new path automatically because Vitest resolves from the file system.)

- [ ] **Step 9: Commit**

```bash
git add apps/web/app/\(app\)/ apps/web/components/app/AppShellClient.tsx
git rm apps/web/app/dashboard/DashboardClient.tsx apps/web/app/dashboard/page.tsx 2>/dev/null || true
git commit -m "feat(app): (app) route group — AppShellClient + migrate dashboard route"
```

---

### Task 3: Migrate journal route into (app) group

The journal at `/journal/[recipientId]` needs to inherit the `(app)` layout (tab bar + auth). Move the entire directory into `app/(app)/`.

**Files:**
- Move: `apps/web/app/journal/` → `apps/web/app/(app)/journal/`

Note: URL stays `/journal/[recipientId]` — route groups don't affect URLs.

- [ ] **Step 1: Move the journal directory**

```bash
mv apps/web/app/journal apps/web/app/\(app\)/journal
```

- [ ] **Step 2: Fix all relative imports in the moved files**

All files in `apps/web/app/(app)/journal/[recipientId]/` previously imported from `../../../lib/...` (3 levels up from `app/journal/[recipientId]/`). They now need 4 levels up (`../../../../lib/...`).

Run TypeScript to find all broken imports:

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "\(app\)/journal" | head -30
```

The pattern: replace `"../../../` with `"../../../../` in all `.tsx`/`.ts` files under the moved journal directory. Also fix `"../../` → `"../../../` where applicable.

Fix them:

```bash
# Adjust depth: 3 levels → 4 levels for lib/server/components imports
find apps/web/app/\(app\)/journal -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|"../../../lib/|"../../../../lib/|g'
find apps/web/app/\(app\)/journal -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|"../../../server/|"../../../../server/|g'
find apps/web/app/\(app\)/journal -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|"../../../components/|"../../../../components/|g'
```

Then recheck:

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "\(app\)/journal"
```

Fix any remaining errors manually.

- [ ] **Step 3: Replace SidebarRail + SidebarSheet with AppTabBar in JournalClient**

Open `apps/web/app/(app)/journal/[recipientId]/JournalClient.tsx`.

The journal currently imports and renders `SidebarRail` and `SidebarSheet`. These are replaced by the `AppTabBar` which is already rendered by `AppShellClient` in the parent layout — so remove the sidebar from JournalClient entirely.

Remove these imports from `JournalClient.tsx`:
```tsx
// REMOVE these imports:
import { SidebarContext, SidebarProvider } from "../../../../components/sidebar/SidebarContext";
import { SidebarRail } from "../../../../components/sidebar/SidebarRail";
import { SidebarSheet } from "../../../../components/sidebar/SidebarSheet";
```

In the JSX return, the outermost structure likely wraps children in `<SidebarProvider>` with `<SidebarRail>` and `<SidebarSheet>`. Remove those wrappers and render content directly. The active panel is still switched by `SidebarContext` — keep `SidebarContext` and `SidebarProvider` internally for panel switching, just remove the visual sidebar components.

The panel switching context (`SidebarContext`) controls which panel renders inside `JournalClient`. Keep `SidebarProvider` wrapping the content but remove `SidebarRail` and `SidebarSheet` from the JSX.

After edits, run:

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "JournalClient"
```

Fix any reported errors.

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all passing. Note: journal tests import components by relative path from the test file location — they resolve fine from the moved directory.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(app\)/journal/
git rm -r apps/web/app/journal/ 2>/dev/null || true
git commit -m "feat(app): migrate journal route into (app) group — inherits AppTabBar layout"
```

---

### Task 4: Team Admin page

**Files:**
- Create: `apps/web/app/(app)/team/admin/page.tsx`
- Create: `apps/web/app/(app)/team/admin/__tests__/page.test.tsx`

The Team Admin page is coordinator-only. Access control is enforced client-side (consistent with existing pattern) by checking the user's role via `/api/members` and redirecting non-coordinators to `/dashboard`.

- [ ] **Step 1: Write failing test**

Create `apps/web/app/(app)/team/admin/__tests__/page.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import TeamAdminPage from "../page";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        not: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  })),
};

vi.mock("@/lib/supabase", () => ({
  createClient: () => mockSupabase,
}));

describe("TeamAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });
  });

  it("redirects to /dashboard when no user", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    const { unmount } = render(<TeamAdminPage />);
    await waitFor(() => {
      expect(window.location.href).toContain("/signin");
    });
    unmount();
  });

  it("renders page heading when coordinator", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        members: [{ user_id: "user-1", role: "coordinator", display_name: "Alex", email: "a@b.com" }],
      }),
    });
    render(<TeamAdminPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /team admin/i })).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/web && npx vitest run "app/\(app\)/team/admin/__tests__/page.test.tsx"
```

Expected: FAIL.

- [ ] **Step 3: Create Team Admin page**

Create `apps/web/app/(app)/team/admin/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { authenticatedFetch } from "@/lib/authenticatedFetch";
import { RoleBadge } from "../../../../components/ui/RoleBadge";

type Member = {
  id: string;
  user_id: string;
  role: "coordinator" | "caregiver" | "aide" | "supporter";
  display_name: string | null;
  email: string | null;
};

export default function TeamAdminPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        window.location.href = "/signin";
        return;
      }

      // Fetch the user's org membership to get orgId and role
      const { data: membership } = await supabase
        .from("memberships")
        .select("org_id, role")
        .eq("user_id", user.id)
        .not("accepted_at", "is", null)
        .single();

      if (!membership) {
        window.location.href = "/dashboard";
        return;
      }

      if (membership.role !== "coordinator") {
        window.location.href = "/dashboard";
        return;
      }

      setOrgId(membership.org_id);

      const res = await authenticatedFetch("/api/members?orgId=" + membership.org_id);
      const data = await res.json();
      if (data.members) setMembers(data.members);
      setLoading(false);
    });
  }, []);

  async function handleRemove(memberId: string) {
    if (!confirm("Remove this team member? They will lose access immediately.")) return;
    const res = await authenticatedFetch("/api/members/" + memberId, { method: "DELETE" });
    if (res.ok) setMembers((prev) => prev.filter((m) => m.id !== memberId));
    else setError("Failed to remove member. Please try again.");
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-[var(--color-muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold text-[var(--color-ink)]">Team Admin</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Manage your care team members and organization settings.
      </p>

      {error && (
        <div role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {/* Member management */}
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-ink)]">Members</h2>
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted)]">Member</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted)]">Role</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-semibold text-white">
                        {(member.display_name ?? member.email ?? "?").slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <p className="font-medium text-[var(--color-ink)]">
                          {member.display_name ?? "Team member"}
                        </p>
                        <p className="text-xs text-[var(--color-muted)]">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={member.role} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {member.role !== "coordinator" && (
                      <button
                        onClick={() => handleRemove(member.id)}
                        className="text-xs font-medium text-[var(--color-danger)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-danger)] focus:ring-offset-1 rounded"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Danger zone */}
      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-danger)]">Danger zone</h2>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-semibold text-[var(--color-ink)]">Delete organization</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Permanently deletes your organization and all care data. This cannot be undone.
            Your data is retained for 30 days before permanent removal.
          </p>
          <button
            className="mt-4 rounded-xl border-2 border-[var(--color-danger)] px-4 py-2 text-sm font-semibold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-danger)] focus:ring-offset-2"
            onClick={() => {
              if (
                confirm(
                  "Are you absolutely sure? Type DELETE to confirm."
                )
              ) {
                alert("Delete org: not yet implemented. Contact hello@carelog.app.");
              }
            }}
          >
            Delete organization
          </button>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```bash
cd apps/web && npx vitest run "app/\(app\)/team/admin/__tests__/page.test.tsx"
```

Expected: `2 passed`.

- [ ] **Step 5: Run full suite**

```bash
pnpm test
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(app\)/team/
git commit -m "feat(app): Team Admin page — coordinator-only, member management, danger zone"
```

---

### Task 5: Subscriptions page

**Files:**
- Create: `apps/web/app/(app)/subscriptions/page.tsx`
- Create: `apps/web/app/(app)/subscriptions/__tests__/page.test.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/app/(app)/subscriptions/__tests__/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import SubscriptionsPage from "../page";

describe("SubscriptionsPage", () => {
  it("renders page heading", () => {
    render(<SubscriptionsPage />);
    expect(screen.getByRole("heading", { name: /subscription/i })).toBeInTheDocument();
  });

  it("shows Family Plan name", () => {
    render(<SubscriptionsPage />);
    expect(screen.getByText(/family plan/i)).toBeInTheDocument();
  });

  it("shows $14/mo price", () => {
    render(<SubscriptionsPage />);
    expect(screen.getByText(/\$14/)).toBeInTheDocument();
  });

  it("shows cancel subscription option", () => {
    render(<SubscriptionsPage />);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/web && npx vitest run "app/\(app\)/subscriptions/__tests__/page.test.tsx"
```

Expected: FAIL.

- [ ] **Step 3: Create Subscriptions page**

Create `apps/web/app/(app)/subscriptions/page.tsx`:

```tsx
"use client";

import { useState } from "react";

const PLAN_FEATURES = [
  "Unlimited team members",
  "Full care journal + reactions + flagging",
  "Medications & shifts",
  "Documents vault",
  "Weekly email digest",
  "Unlimited history",
] as const;

// Placeholder billing history — replace with Stripe webhook data when wired.
const BILLING_HISTORY: Array<{
  date: string;
  amount: string;
  status: "paid" | "pending";
}> = [];

export default function SubscriptionsPage() {
  const [showCancelModal, setShowCancelModal] = useState(false);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold text-[var(--color-ink)]">Subscription</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Manage your plan and billing.
      </p>

      {/* Current plan card */}
      <section className="mt-8 rounded-2xl border-2 border-[var(--color-primary)] bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-ink)]">Family Plan</h2>
            <p className="mt-1 text-3xl font-extrabold text-[var(--color-primary)]">
              $14
              <span className="text-sm font-normal text-[var(--color-muted)]">/mo</span>
            </p>
          </div>
          <span className="rounded-full bg-[var(--color-primary-subtle)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
            Active
          </span>
        </div>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Next renewal: —
        </p>

        {/* Feature list */}
        <ul className="mt-4 flex flex-col gap-2" role="list">
          {PLAN_FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
              <span className="text-[var(--color-success)]" aria-hidden="true">✓</span>
              {f}
            </li>
          ))}
        </ul>

        {/* Stripe placeholder */}
        <p className="mt-6 rounded-xl bg-[var(--color-surface)] px-4 py-3 text-xs text-[var(--color-muted)]">
          Billing portal coming soon. To update payment details, email{" "}
          <a href="mailto:hello@carelog.app" className="text-[var(--color-primary)] underline underline-offset-2">
            hello@carelog.app
          </a>
          .
        </p>
      </section>

      {/* Billing history */}
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-ink)]">Billing history</h2>
        {BILLING_HISTORY.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No billing history yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-muted)]">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-muted)]">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-muted)]">Status</th>
                </tr>
              </thead>
              <tbody>
                {BILLING_HISTORY.map((item, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-4 py-3 text-[var(--color-ink)]">{item.date}</td>
                    <td className="px-4 py-3 text-[var(--color-ink)]">{item.amount}</td>
                    <td className="px-4 py-3">
                      <span className={
                        item.status === "paid"
                          ? "text-[var(--color-success)]"
                          : "text-[var(--color-warning)]"
                      }>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Cancel */}
      <section className="mt-10">
        <button
          onClick={() => setShowCancelModal(true)}
          className="text-sm font-medium text-[var(--color-danger)] underline underline-offset-2 hover:no-underline focus:outline-none"
        >
          Cancel subscription
        </button>
      </section>

      {/* Cancel modal */}
      {showCancelModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCancelModal(false); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <h2 id="cancel-title" className="text-lg font-bold text-[var(--color-ink)]">
              Cancel subscription?
            </h2>
            <p className="mt-3 text-sm text-[var(--color-muted)]">
              Your family&#39;s data is preserved for 30 days after cancellation.
              You can reactivate at any time. Cancellation takes effect at the end
              of your current billing period.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 rounded-xl border-2 border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
              >
                Keep my subscription
              </button>
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  alert("Cancellation: contact hello@carelog.app — Stripe not yet wired.");
                }}
                className="flex-1 rounded-xl bg-[var(--color-danger)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-danger)] focus:ring-offset-2"
              >
                Cancel subscription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```bash
cd apps/web && npx vitest run "app/\(app\)/subscriptions/__tests__/page.test.tsx"
```

Expected: `4 passed`.

- [ ] **Step 5: Run full suite**

```bash
pnpm test
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(app\)/subscriptions/
git commit -m "feat(app): Subscriptions page — plan card, billing history, cancel modal"
```

---

### Task 6: Reskin Sign In page

**Files:**
- Modify: `apps/web/app/signin/page.tsx`
- Modify: `apps/web/app/signin/SignInForm.tsx`

The sign in page is outside both shells. Apply the Violet & Plum design tokens. No logic changes.

- [ ] **Step 1: Read current signin page**

```bash
cat apps/web/app/signin/page.tsx
cat apps/web/app/signin/SignInForm.tsx
```

- [ ] **Step 2: Reskin page.tsx**

Open `apps/web/app/signin/page.tsx` and replace the layout with:

```tsx
import { SignInForm } from "./SignInForm";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-surface)] px-4 py-16">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary)]" aria-hidden="true" />
        <span className="text-xl font-bold tracking-tight text-[var(--color-ink)]">Carelog</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-white px-8 py-10 shadow-sm">
        <h1 className="mb-6 text-center text-xl font-bold text-[var(--color-ink)]">
          Sign in to Carelog
        </h1>

        {params.error && (
          <div
            role="alert"
            className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]"
          >
            {params.error === "auth_callback_failed"
              ? "Something went wrong. Please try again."
              : params.error}
          </div>
        )}

        {params.message && (
          <div className="mb-4 rounded-xl bg-[var(--color-primary-subtle)] px-4 py-3 text-sm text-[var(--color-primary)]">
            {params.message}
          </div>
        )}

        <SignInForm />
      </div>

      {/* Trust tagline */}
      <p className="mt-6 text-center text-xs text-[var(--color-muted)]">
        Private, secure, and ad-free. Your family&apos;s information never leaves your care team.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Reskin SignInForm.tsx**

Open `apps/web/app/signin/SignInForm.tsx` and update the input and button styling to use design system classes. Keep all logic (OTP flow, actions) unchanged. Only update `className` props:

- Email input: `className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1"`
- Submit button: `className="w-full rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]/90 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"`
- Label: `className="block text-sm font-medium text-[var(--color-ink)] mb-1.5"`

- [ ] **Step 4: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run full suite**

```bash
pnpm test
```

Expected: all passing (existing SignInForm tests pass — only classNames changed).

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/signin/
git commit -m "feat(app): reskin Sign In page with Violet & Plum design tokens"
```

---

### Task 7: Final type-check and verification

- [ ] **Step 1: Full TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Full test suite**

```bash
pnpm test
```

Expected: all test files passing.

- [ ] **Step 3: Verify route structure**

```bash
ls apps/web/app/\(app\)/
```

Expected output includes: `layout.tsx dashboard/ journal/ team/ subscriptions/`

```bash
ls apps/web/app/\(marketing\)/
```

Expected output includes: `layout.tsx page.tsx about/ contact/ pricing/ privacy/ terms/`

- [ ] **Step 4: Lint**

```bash
pnpm lint
```

Fix any lint errors before merging.

- [ ] **Step 5: Final commit if any cleanup**

```bash
git add -p
git commit -m "chore(app): final type fixes and cleanup"
```
