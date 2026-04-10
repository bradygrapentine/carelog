# Design System — Violet & Plum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing blue-slate design tokens in `globals.css` with the Violet & Plum palette and fix the body font so Geist is used consistently throughout.

**Architecture:** All tokens live in the `@theme inline` block in `globals.css`. Components use Tailwind utility classes that reference these tokens — no component logic changes. The shadcn HSL bridge variables are also updated so shadcn primitives (Button, Badge, Card) render in violet automatically.

**Tech Stack:** Tailwind v4 `@theme inline`, CSS custom properties, shadcn/ui, Geist (Next.js font)

---

### Task 1: Update design tokens in globals.css

**Files:**
- Modify: `apps/web/app/globals.css`

The `@theme inline` block currently uses blue (`#2563eb`) as the brand color. Replace the entire `@theme inline` block and `:root` block with the Violet & Plum system. The shadcn HSL bridge variables must be updated too — shadcn reads `--primary` as an HSL triplet, not hex.

- [ ] **Step 1: Open `apps/web/app/globals.css` and replace the full file contents**

Replace the entire file with:

```css
@import "tailwindcss";
@import "tw-animate-css";

:root {
  --background: #faf5ff;
  --foreground: #1e0a3c;
}

@theme inline {
  /* === Violet & Plum palette === */

  /* Primary */
  --color-primary:        #7c3aed;   /* Violet 600 */
  --color-primary-light:  #a78bfa;   /* Violet 400 */
  --color-primary-subtle: #ede9fe;   /* Violet 100 */

  /* Ink & surface */
  --color-ink:     #1e0a3c;   /* Deep plum — headings, app tab bar bg */
  --color-surface: #faf5ff;   /* Violet 50 — page backgrounds */

  /* Text */
  --color-text-primary:   #1e0a3c;
  --color-text-secondary: #4b5563;
  --color-muted:          #6b7280;

  /* Border */
  --color-border: #ede9fe;

  /* Semantic */
  --color-warning: #f59e0b;
  --color-success: #10b981;
  --color-danger:  #ef4444;

  /* Mood (journal) */
  --color-mood-good:      #22c55e;
  --color-mood-okay:      #f59e0b;
  --color-mood-difficult: #f97316;
  --color-mood-crisis:    #ef4444;

  /* Radius scale */
  --radius-sm:   6px;
  --radius-md:   10px;
  --radius-lg:   14px;
  --radius-xl:   20px;

  /* Typography */
  --font-sans: 'Geist', system-ui, sans-serif;

  /* === shadcn/ui HSL bridge ===
     shadcn reads these as "H S% L%" triplets (no hsl() wrapper).
     Violet 600 = hsl(262, 83%, 58%)
     Violet 50  = hsl(270, 100%, 98%)
     Deep plum  = hsl(270, 90%, 14%)
  */
  --background:          270 100% 98%;   /* surface */
  --foreground:          270 90%  14%;   /* ink */
  --card:                0   0%   100%;
  --card-foreground:     270 90%  14%;
  --border:              270 100% 93%;   /* primary-subtle */
  --input:               270 100% 93%;
  --ring:                262 83%  58%;   /* primary */
  --radius:              0.625rem;       /* 10px */
  --primary:             262 83%  58%;   /* #7c3aed */
  --primary-foreground:  0   0%   100%;
  --secondary:           270 100% 93%;   /* primary-subtle */
  --secondary-foreground: 270 90% 14%;
  --muted:               270 100% 93%;
  --muted-foreground:    220 9%   46%;
  --accent:              270 100% 93%;
  --accent-foreground:   270 90%  14%;
  --destructive:         0   84%  60%;   /* danger */
  --destructive-foreground: 0 0%  100%;
  --popover:             0   0%   100%;
  --popover-foreground:  270 90%  14%;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
}
```

- [ ] **Step 2: Fix the root layout body to use Geist variable class only**

Open `apps/web/app/layout.tsx`. Currently the `<body>` has `className={inter.className}` which overrides Geist. Fix it:

```tsx
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { TrpcProvider } from "../components/providers/TrpcProvider";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Carelog",
  description: "Care coordination for families",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body suppressHydrationWarning>
        <TrpcProvider>{children}</TrpcProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Verify Tailwind classes that reference old brand tokens compile**

Search for any remaining references to the old blue brand tokens:

```bash
grep -r "color-brand\|#2563eb\|#1d4ed8\|#eff6ff\|#bfdbfe" apps/web --include="*.tsx" --include="*.ts" --include="*.css" -l
```

Expected: no files listed (all old tokens have been removed from globals.css; if any component still references them directly via `var(--color-brand-*)`, update those references to use `var(--color-primary)` instead).

- [ ] **Step 5: Run tests**

```bash
pnpm test
```

Expected: `Test Files 66 passed (66)` — no regressions from a CSS-only change.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/globals.css apps/web/app/layout.tsx
git commit -m "feat(design): Violet & Plum token system — replace blue palette in globals.css"
```

---

### Task 2: Update sidebar tokens to use new palette

The existing `SidebarRail` and `SidebarSheet` use `var(--color-sidebar-bg)` which was `#0f172a` (slate). Update these to use `var(--color-ink)` (#1e0a3c, deep plum) so the existing journal sidebar matches the new palette until it is replaced by the AppTabBar in the app shell plan.

**Files:**
- Modify: `apps/web/components/sidebar/SidebarRail.tsx`
- Modify: `apps/web/components/sidebar/SidebarNav.tsx`

- [ ] **Step 1: Read SidebarRail.tsx**

```bash
cat apps/web/components/sidebar/SidebarRail.tsx
```

- [ ] **Step 2: Replace sidebar bg and active colors**

In `SidebarRail.tsx`, find the `bg-[var(--color-sidebar-bg)]` class (or equivalent inline style) and replace with `bg-[var(--color-ink)]`.

In `SidebarNav.tsx`, the active item currently uses `bg-[var(--color-sidebar-active)]`. Replace with `bg-[rgba(167,139,250,0.2)]` (violet-tinted active state) and the active text/border color with `text-white border-[rgba(167,139,250,0.5)]`.

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Expected: `Test Files 66 passed (66)`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/sidebar/
git commit -m "feat(design): update sidebar colors to Violet & Plum palette"
```

---

### Task 3: Add RoleBadge component

`RoleBadge` is used by the TeamPanel (existing), the new Team page, and Team Admin. Build it once here so downstream plans can import it.

**Files:**
- Create: `apps/web/components/ui/RoleBadge.tsx`
- Create: `apps/web/components/ui/__tests__/RoleBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/components/ui/__tests__/RoleBadge.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { RoleBadge } from "../RoleBadge";

describe("RoleBadge", () => {
  it("renders coordinator with violet style", () => {
    render(<RoleBadge role="coordinator" />);
    const badge = screen.getByText("Coordinator");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/violet|purple/i);
  });

  it("renders caregiver with amber style", () => {
    render(<RoleBadge role="caregiver" />);
    expect(screen.getByText("Caregiver")).toBeInTheDocument();
  });

  it("renders supporter with gray style", () => {
    render(<RoleBadge role="supporter" />);
    expect(screen.getByText("Supporter")).toBeInTheDocument();
  });

  it("renders aide with slate style", () => {
    render(<RoleBadge role="aide" />);
    expect(screen.getByText("Aide")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/web && npx vitest run components/ui/__tests__/RoleBadge.test.tsx
```

Expected: FAIL — `RoleBadge` not found.

- [ ] **Step 3: Create RoleBadge component**

Create `apps/web/components/ui/RoleBadge.tsx`:

```tsx
import { cn } from "@/lib/utils";

type Role = "coordinator" | "caregiver" | "aide" | "supporter";

const ROLE_STYLES: Record<Role, string> = {
  coordinator: "bg-violet-100 text-violet-800",
  caregiver:   "bg-amber-100  text-amber-800",
  aide:        "bg-slate-100  text-slate-700",
  supporter:   "bg-gray-100   text-gray-600",
};

const ROLE_LABELS: Record<Role, string> = {
  coordinator: "Coordinator",
  caregiver:   "Caregiver",
  aide:        "Aide",
  supporter:   "Supporter",
};

type Props = {
  role: Role;
  className?: string;
};

export function RoleBadge({ role, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        ROLE_STYLES[role] ?? "bg-gray-100 text-gray-600",
        className
      )}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
cd apps/web && npx vitest run components/ui/__tests__/RoleBadge.test.tsx
```

Expected: `4 passed`.

- [ ] **Step 5: Run full suite**

```bash
pnpm test
```

Expected: `Test Files 67 passed (67)`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/ui/RoleBadge.tsx apps/web/components/ui/__tests__/RoleBadge.test.tsx
git commit -m "feat(ui): add RoleBadge component — coordinator/caregiver/aide/supporter"
```
