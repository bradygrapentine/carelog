# UI Redesign Backlog

Items deliberately excluded from the initial redesign (Phase 1) due to scope or regression risk. Ordered by impact.

---

## High Impact

### Loading skeletons
**What:** Animated placeholder shimmer for panels while tRPC queries are in-flight.
**Why deferred:** Requires wrapping every panel in a Suspense/loading state boundary — high regression surface.
**When:** After Phase 1 stabilizes. Use shadcn's skeleton primitive + React Suspense boundaries per panel.

### Empty states
**What:** Illustrated or designed empty states for Journal (no entries yet), Medications (none added), Team (no members), Documents (vault empty).
**Why deferred:** Requires design decisions on illustration style and copy — separate creative work.
**When:** After Phase 1. Pair with a copywriter pass on UX language.

### Micro-interactions
**What:** Subtle transitions — card hover lift, mood selector press animation, sidebar icon active state animation, toast notifications.
**Why deferred:** Easy to get wrong; can feel cheap. Requires careful QA across panel interactions.
**When:** After empty states. Use Tailwind `transition` utilities + Radix animation primitives.

---

## Medium Impact

### Dark mode
**What:** Full dark theme using Tailwind v4 `@theme` dark variant and `prefers-color-scheme` detection.
**Why deferred:** Design token layer (Phase 1) is the prerequisite — dark mode maps each token to a dark value.
**When:** After Phase 1 ships. Relatively mechanical once tokens are in place.

### Mobile-optimized journal entry
**What:** Bottom-sheet style entry form on mobile instead of inline card. Mood selector as a horizontal swipeable row.
**Why deferred:** Requires Playwright mobile viewport testing and UX research on caregiver mobile patterns.
**When:** When mobile usage data justifies the investment.

### Sidebar labels on hover (tooltip)
**What:** Tooltip showing destination name on icon hover for the desktop sidebar rail.
**Why deferred:** Minor UX polish. shadcn `Tooltip` is available after Phase 1.
**When:** Phase 1 follow-up, low effort.

### Active panel breadcrumb / page title
**What:** Top bar dynamically shows recipient name + section (e.g., "Dad · Medications"). Currently planned as static.
**Why deferred:** Requires SidebarContext to propagate section metadata — slightly more complex than the base implementation.
**When:** Phase 1 follow-up.

---

## Lower Impact

### Storybook component library
**What:** Isolated component development and documentation using Storybook.
**Why deferred:** Adds build tooling complexity. Most valuable once component surface stabilizes.
**When:** Post-launch, if component count grows significantly.

### Visual regression testing
**What:** Playwright screenshot comparisons or Percy/Chromatic integration to catch unintended visual changes.
**Why deferred:** Meaningful after the design stabilizes — before that, screenshots change every sprint.
**When:** After dark mode ships (last major visual change expected).

### Export styling
**What:** The exported care brief (`/brief/[shareToken]`) and care view (`/care/[shareToken]`) currently have independent styling. Align them with the new token layer.
**Why deferred:** These are public-facing, read-only views — functional but visually inconsistent with the app post-redesign.
**When:** After Phase 1. Low regression risk (no forms or interactivity).

### Onboarding flow redesign
**What:** The onboarding and sign-in pages use minimal styling. Apply the new design system.
**Why deferred:** Low traffic relative to the journal. Functional as-is.
**When:** Pre-launch polish pass.
