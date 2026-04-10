---
title: UI Redesign — Clean & Structured
date: 2026-04-10
status: approved
---

# UI Redesign — Clean & Structured

A coherent visual overhaul of the Carelog web app. The right components are already present — this design addresses layout, hierarchy, and consistency through a component library foundation, design token layer, icon sidebar navigation, and systematic panel reskinning.

---

## Decisions

| Dimension | Choice | Rationale |
|-----------|--------|-----------|
| Design direction | Clean & Structured | Blue/slate palette, crisp grid, efficient SaaS feel — trustworthy and competent |
| Layout | Icon sidebar + main content | Panels become sidebar destinations; eliminates the stacked-column wall-of-panels problem |
| Component library | shadcn/ui + custom Tailwind v4 tokens | Copy-paste primitives with owned code; custom token layer enforces brand consistency |
| Responsive | Full breakpoint support | Mobile: hidden sidebar + top-bar hamburger → Sheet drawer; Desktop: fixed icon rail |

---

## Design Tokens

Defined in `apps/web/app/globals.css` using Tailwind v4's `@theme` block. All components reference tokens, never raw hex values.

```css
@theme inline {
  /* Brand */
  --color-brand:        #2563eb;
  --color-brand-hover:  #1d4ed8;
  --color-brand-subtle: #eff6ff;
  --color-brand-border: #bfdbfe;

  /* Surface */
  --color-surface:        #ffffff;
  --color-surface-raised: #f8fafc;
  --color-surface-muted:  #f1f5f9;

  /* Text */
  --color-text-primary:   #0f172a;
  --color-text-secondary: #475569;
  --color-text-muted:     #94a3b8;

  /* Borders */
  --color-border:       #e2e8f0;
  --color-border-focus: #2563eb;

  /* Sidebar */
  --color-sidebar-bg:      #0f172a;
  --color-sidebar-item:    #1e293b;
  --color-sidebar-active:  rgba(59, 130, 246, 0.15);

  /* Semantic — mood */
  --color-mood-good:      #22c55e;
  --color-mood-okay:      #f59e0b;
  --color-mood-difficult: #f97316;
  --color-mood-crisis:    #ef4444;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
}
```

---

## Sidebar Architecture

### Desktop (≥768px)

A fixed 60px icon rail on the left edge. Each icon maps to a primary destination (panel). The active icon has a blue-tinted background ring. A logo mark sits at the top; user avatar at the bottom.

**Sidebar destinations:**

| Icon | Destination | Panel(s) |
|------|-------------|----------|
| 📋 | Journal | JournalTimeline + JournalEntryForm |
| 💊 | Medications | MedicationPanel + MedicationChecklist |
| 👥 | Team | TeamPanel + OuterCirclePanel |
| 📅 | Shifts | ShiftForm + ShiftList |
| 📁 | Documents | DocumentVault + OcrReviewPanel |
| ⋯ | More | BurnoutCheckin, EolPlanner, BenefitsNavigator, ExpensePanel, ExportButton |

### Mobile (<768px)

Sidebar is hidden. Top bar shows a hamburger button (≡) on the left. Tapping opens a shadcn `Sheet` (left-edge drawer) containing the same nav list — icon + label text. Sheet closes on nav selection.

### Shared component

```
components/
  sidebar/
    SidebarNav.tsx        — nav item list, shared between desktop rail and mobile Sheet
    SidebarRail.tsx       — desktop fixed 60px wrapper
    SidebarSheet.tsx      — mobile Sheet wrapper (shadcn Sheet)
    SidebarContext.tsx    — active destination state (React context)
```

---

## Component Migration

### shadcn/ui components to install

```bash
pnpm dlx shadcn@latest add button card badge input textarea sheet separator avatar tooltip
```

### Migration pattern

Every panel follows the same reskinning pattern. Internal logic (tRPC hooks, state, handlers) is untouched. Only the JSX shell changes:

**Before:**
```tsx
<div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
  <h3 className="text-sm font-semibold text-gray-900">Panel title</h3>
  ...
</div>
```

**After:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Panel title</CardTitle>
  </CardHeader>
  <CardContent>
    ...
  </CardContent>
</Card>
```

### Panels in scope

All panels receive the Card wrapper + token-based styling. The journal-specific components receive deeper treatment:

**Deep treatment (visual redesign):**
- `JournalEntryForm` — mood selector as shadcn toggle group, textarea as shadcn Textarea, submit as shadcn Button
- `JournalTimeline` — date group headers, mood dot indicator, role Badge
- Nav header — replaced by top bar + sidebar

**Shell treatment (Card + tokens only, logic untouched):**
- `MedicationPanel`, `MedicationChecklist`
- `TeamPanel`, `OuterCirclePanel`
- `ShiftForm`, `ShiftList`
- `DocumentVault`, `OcrReviewPanel`
- `BurnoutCheckin`, `EolPlanner`, `BenefitsNavigator`, `ExpensePanel`

### Role badges

Unified semantic mapping using shadcn `Badge` with token-derived variants:

| Role | Variant |
|------|---------|
| Coordinator | `bg-purple-100 text-purple-800` |
| Caregiver | `bg-blue-100 text-blue-800` |
| Supporter | `bg-green-100 text-green-800` |
| Aide | `bg-orange-100 text-orange-800` |

### Mood indicators

Color dot (8px circle) + Badge using semantic mood tokens:

| Mood | Dot | Badge bg |
|------|-----|----------|
| Good | `--color-mood-good` | `dcfce7 / 166534` |
| Okay | `--color-mood-okay` | `fef9c3 / 854d0e` |
| Difficult | `--color-mood-difficult` | `ffedd5 / 9a3412` |
| Crisis | `--color-mood-crisis` | `fee2e2 / 991b1b` |

---

## Layout Structure

```
app/journal/[recipientId]/
  layout.tsx                — adds sidebar shell wrapper
  JournalClient.tsx         — renders active panel based on SidebarContext
  page.tsx                  — unchanged
```

The `JournalClient` switches rendered panel based on `activeDestination` from `SidebarContext`. Each destination renders its panel(s) in the main content area at full width.

Top bar (52px, white, border-bottom):
- Left: recipient name + current section label
- Right: primary action button (context-dependent: "+ New entry", "+ Add medication", etc.)

---

## Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| `< 768px` | No sidebar rail; hamburger in top bar; main content full-width; cards stack |
| `≥ 768px` | 60px icon rail fixed left; main content has `pl-[60px]` |

---

## Scope Boundaries

**In scope:**
- Tailwind v4 design token layer
- shadcn/ui installation + configuration
- Icon sidebar (desktop rail + mobile Sheet)
- Top bar
- Deep treatment of Journal surfaces
- Shell treatment (Card + tokens) for all remaining panels
- Responsive breakpoints

**Out of scope:**
- Loading skeletons / skeleton screens
- Micro-interactions and CSS transitions
- Empty state illustrations
- Dark mode
- Mobile-specific layout optimizations beyond breakpoints
- Storybook or visual regression testing infrastructure
