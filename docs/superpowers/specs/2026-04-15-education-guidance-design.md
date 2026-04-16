# Education & Behavior Guidance — Design Spec

**Date:** 2026-04-15
**Status:** Draft — awaiting implementation plan
**Scope:** Web app (Next.js). Mobile parity deferred to v2.

---

## Overview

A curated education library of Carelog-authored guides (summaries + tips in Carelog's voice, linking to authoritative external sources) combined with AI-powered retrieval. Guides are stored as markdown files in the codebase. The AI assistant uses tag-based RAG to surface and cite relevant guides when answering education questions. A daily dashboard widget proactively surfaces the most relevant guide based on recent care patterns.

---

## Content Model

### File structure

```
content/education/
  sundowning.md
  repetitive-questions.md
  medication-refusal.md
  wandering.md
  caregiver-burnout.md
  ... (one file per guide)
```

### Frontmatter schema

```yaml
---
title: "Managing Sundowning"
summary: "1–2 sentence summary used as AI context — concise, factual"
challenges: [sundowning, agitation, evening-restlessness]
topics: [dementia, behavior-management]
external_url: "https://alz.org/..."
tips:
  - "Try moving dinner 30 minutes earlier"
  - "Dim lights by 4pm"
  - "Reduce afternoon stimulation"
---

[Full guide body in markdown — Carelog voice, 200–400 words]
```

**Tag taxonomy:**

- `challenges` — specific behaviors or situations (sundowning, wandering, repetitive-questions, medication-refusal, aggression, sleep-disruption, caregiver-burnout, refusing-care)
- `topics` — broader domains (dementia, behavior-management, medication-management, caregiver-wellbeing, legal-financial, communication)

Each guide has both. The AI uses `challenges` tags for retrieval; users filter by `topics` when browsing.

---

## Navigation & Placement

### 1 — /education page (sidebar item)
A dedicated first-class route in the main sidebar nav alongside Journal, Medications, etc.

**Layout:**
- Topic tag filter bar across the top (All / Dementia / Behavior / Wellbeing / etc.)
- Guide card grid — each card shows title, 1-line summary, challenge + topic tags
- Clicking a card navigates to `/education/[slug]`

### 2 — Guide detail page (/education/[slug])
- Title + tag chips
- Full markdown body (rendered via `next-mdx-remote`)
- "Quick tips" block (from frontmatter `tips` array)
- External link card (amber accent, links to `external_url`)

### 3 — Dashboard tip widget
- Rendered on the main dashboard below the care summary
- Shows: "Based on recent activity" label + guide title + 1-line contextual callout + "Read guide" CTA + "Dismiss" button
- Dismissable: clicking "Dismiss" hides the widget for the current user for 7 days. Stored as `dismissed_until: timestamptz` on a per-user basis in `user_profiles` (single column, no separate table needed)
- Refreshes daily via Inngest cron

---

## AI Integration (tag-based RAG)

When a user sends a prompt to the AI assistant that contains education intent (detected via keyword matching against the full challenge + topic tag list):

1. Extract challenge/topic keywords from prompt
2. Call `getGuidesByTags(tags)` → returns matching guides sorted by tag overlap
3. Inject top guide(s) `title + summary + tips` into the Claude API context
4. System prompt instructs Claude to cite the guide title in its response
5. Response payload includes `citations: [{ title, slug }]`
6. Client renders a citation card beneath the AI response linking to `/education/[slug]`

**Non-education queries:** guides are not loaded — no overhead on normal AI queries.

---

## Backend

### `lib/education.ts`

```ts
getAllGuides(): Guide[]
getGuideBySlug(slug: string): Guide
getGuidesByTags(tags: string[]): Guide[]   // RAG lookup — sorted by tag overlap count
```

Uses `gray-matter` to parse frontmatter and `next-mdx-remote` to serialize body content. Reads from the filesystem at build time (static — no DB reads for the library itself).

### Inngest function: `educationTip.refresh`

Runs daily per org:

1. Query last 7 days of care events + mood entries → count challenge tag frequencies
2. Call `getGuidesByTags(topChallenges)` → pick the guide with highest tag overlap
3. Upsert result to `education_tip_cache` (org_id, guide_slug, refreshed_at)

---

## Schema

### New table: `education_tip_cache`

```sql
CREATE TABLE education_tip_cache (
  org_id        uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  guide_slug    text NOT NULL,
  refreshed_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE education_tip_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read own row" ON education_tip_cache
  USING (
    org_id IN (
      SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
    )
  );
```

No PHI stored — only a guide slug reference per org.

### Migration: `user_profiles`

```sql
ALTER TABLE user_profiles
  ADD COLUMN education_tip_dismissed_until timestamptz;
```

---

## Testing

### Vitest (unit)
- `getGuidesByTags`: given a tag set, returns guides with correct overlap ranking
- Tag extraction: known keywords map to expected challenge tags
- `educationTip.refresh` logic: given care event tag frequencies, selects the correct guide slug

### Playwright (E2E)
- `/education` renders guide list; tag filter reduces visible cards correctly
- Guide detail page renders markdown body, quick tips block, and external link
- Dashboard tip card is present on dashboard and links to correct `/education/[slug]`

### pgTAP
- `education_tip_cache`: org member reads own org row ✓
- Cross-org read blocked ✓
- Anon blocked ✓

---

## Out of Scope (v1)

- Mobile app (deferred to v2)
- Admin panel for editing guides in-browser (edit markdown files directly)
- User-submitted guides or community content
- Semantic/vector search (upgrade path if tag matching proves insufficient)
- Guide bookmarking / reading history
- Multi-language guides
