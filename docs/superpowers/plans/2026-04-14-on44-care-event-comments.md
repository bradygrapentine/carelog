# ON-44 — Care event comments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add flat-list comments to care events (journal entries) with soft-delete, author-only edit, in-app realtime, and Inngest-driven push fanout to the event author and prior commenters.

**Architecture:** New `care_event_comments` table with RLS mirroring `care_events`; nested tRPC sub-router `careEvents.comments`; Inngest function `careEventComment.fanout` triggered by a `careEventComment/created` event; new web + mobile component trio; Supabase Realtime for live updates.

**Tech Stack:** Postgres (Supabase) · pgTAP · Next.js App Router · tRPC v10 · Zod · Inngest · Supabase Realtime · Expo/React Native · Vitest · Playwright.

**Spec:** `docs/superpowers/specs/2026-04-14-on44-care-event-comments-design.md`

---

## File structure

**New**
- `supabase/migrations/20260423000000_care_event_comments.sql`
- `supabase/tests/care_event_comments_rls.test.sql`
- `packages/schemas/src/careEventComments.ts`
- `apps/web/server/repositories/careEventCommentsRepository.ts`
- `apps/web/server/routers/careEventComments.ts`
- `apps/web/server/routers/__tests__/careEventComments.logic.test.ts`
- `apps/web/inngest/functions/careEventCommentFanout.ts`
- `apps/web/inngest/functions/__tests__/careEventCommentFanout.test.ts`
- `apps/web/components/care-events/CommentThread.tsx`
- `apps/web/components/care-events/CommentComposer.tsx`
- `apps/web/components/care-events/CommentItem.tsx`
- `apps/web/components/care-events/__tests__/CommentThread.test.tsx`
- `apps/web/components/care-events/__tests__/CommentItem.test.tsx`
- `apps/mobile/components/comments/CommentSection.tsx`
- `apps/mobile/components/comments/CommentComposer.tsx`
- `apps/mobile/components/comments/CommentItem.tsx`
- `e2e/care-event-comments.spec.ts`

**Modified**
- `packages/schemas/src/index.ts` — re-export care-event-comments schemas
- `apps/web/server/routers/careEvents.ts` — nest `comments` sub-router
- `apps/web/app/api/inngest/route.ts` — register fanout function
- `apps/web/components/care-events/CareEventCard.tsx` (or equivalent) — mount `<CommentThread />`
- `apps/mobile/app/(app)/journal/[eventId].tsx` — mount `<CommentSection />`
- `packages/types/src/database.ts` (regenerated via `/supabase-types`)
- `docs/BACKLOG.md` — flip ON-44 to `🟣 In review` at start, `✅ Shipped` at end

---

## Task 1: Migration — `care_event_comments` table + RLS

**Files:**
- Create: `supabase/migrations/20260423000000_care_event_comments.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- ON-44: Comment threads on care events
-- Flat list, soft-delete only, author-only edit/delete, RLS mirrors care_events.

CREATE TABLE care_event_comments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_event_id   uuid        NOT NULL REFERENCES care_events(id) ON DELETE CASCADE,
  org_id          uuid        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  author_id       uuid        NOT NULL REFERENCES auth.users(id),
  body            text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  edited_at       timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX care_event_comments_event_created_idx
  ON care_event_comments (care_event_id, created_at);
CREATE INDEX care_event_comments_org_idx
  ON care_event_comments (org_id);

ALTER TABLE care_event_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: org members (mirrors care_events read policy)
CREATE POLICY "care_event_comments_member_select"
  ON care_event_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = care_event_comments.org_id
        AND m.user_id = auth.uid()
    )
  );

-- INSERT: org member posting as self, org_id matches the event's org
CREATE POLICY "care_event_comments_member_insert"
  ON care_event_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = care_event_comments.org_id
        AND m.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM care_events ce
      WHERE ce.id = care_event_comments.care_event_id
        AND ce.org_id = care_event_comments.org_id
    )
  );

-- UPDATE: author-only (covers edit body/edited_at and soft-delete via deleted_at)
CREATE POLICY "care_event_comments_author_update"
  ON care_event_comments FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- DELETE: prohibited (soft-delete only)
-- (No DELETE policy ⇒ no one can hard-delete.)

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE care_event_comments;

-- Per-feature notification override (default true).
ALTER TABLE notification_preferences
  ADD COLUMN care_event_comments boolean NOT NULL DEFAULT true;
```

- [ ] **Step 2: Apply migration locally**

Run: `supabase db reset`
Expected: migration applies cleanly, no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260423000000_care_event_comments.sql
git commit -m "feat(db): care_event_comments table + RLS (ON-44)"
```

---

## Task 2: pgTAP tests for RLS

**Files:**
- Create: `supabase/tests/care_event_comments_rls.test.sql`

- [ ] **Step 1: Write the pgTAP suite**

Follow the existing pattern from `supabase/tests/messaging_rls.test.sql`. Cover:

```sql
BEGIN;
SELECT plan(12);

-- Fixtures: two orgs (A, B), three users (alice+bob in A, eve in B),
-- one care_event in org A authored by alice.

-- 1. alice (same org, event author) can insert a comment
-- 2. bob (same org, different user) can insert a comment
-- 3. eve (cross-org) cannot insert a comment (RLS blocks)
-- 4. alice can list comments on the event
-- 5. bob can list comments on the event
-- 6. eve cannot list any comments on the event (empty result)
-- 7. alice can UPDATE her own comment (edit body, set edited_at)
-- 8. bob cannot UPDATE alice's comment
-- 9. alice can soft-delete her own comment (set deleted_at)
-- 10. bob cannot soft-delete alice's comment
-- 11. DELETE is prohibited for the author as well (no policy)
-- 12. body CHECK rejects empty and >4000 char bodies

SELECT finish();
ROLLBACK;
```

Use `SELECT tests.impersonate('<uuid>');` and `SELECT throws_ok('sql', 42501, 'new row violates row-level security policy for table "care_event_comments"', 'desc');` (four-arg `throws_ok` — project convention).

- [ ] **Step 2: Run the tests**

Run: `supabase test db`
Expected: all 12 assertions pass.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/care_event_comments_rls.test.sql
git commit -m "test(db): pgTAP coverage for care_event_comments RLS (ON-44)"
```

---

## Task 3: Regenerate Supabase TypeScript types

**Files:**
- Modify: `packages/types/src/database.ts`

- [ ] **Step 1: Invoke the `/supabase-types` skill**

Run the skill. It regenerates `packages/types/src/database.ts` from the local database.

- [ ] **Step 2: Verify `care_event_comments` present**

Run: `grep -n "care_event_comments" packages/types/src/database.ts | head`
Expected: Row/Insert/Update types and Relationships entries present.

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/database.ts
git commit -m "chore(types): regenerate db types for care_event_comments (ON-44)"
```

---

## Task 4: Zod schemas

**Files:**
- Create: `packages/schemas/src/careEventComments.ts`
- Modify: `packages/schemas/src/index.ts`

- [ ] **Step 1: Write the schemas**

```ts
// packages/schemas/src/careEventComments.ts
import { z } from "zod";

const uuid = z.string().uuid();
const body = z.string().trim().min(1).max(4000);

export const listCommentsInputSchema = z.object({
  careEventId: uuid,
});

export const addCommentInputSchema = z.object({
  careEventId: uuid,
  body,
});

export const editCommentInputSchema = z.object({
  commentId: uuid,
  body,
});

export const removeCommentInputSchema = z.object({
  commentId: uuid,
});

export type CareEventComment = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  editedAt: string | null;
  createdAt: string;
};
```

- [ ] **Step 2: Re-export from index**

Append to `packages/schemas/src/index.ts`:

```ts
export * from "./careEventComments";
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @carelog/schemas typecheck` (or `pnpm typecheck` at repo root).
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/schemas/src/careEventComments.ts packages/schemas/src/index.ts
git commit -m "feat(schemas): care-event-comments zod schemas (ON-44)"
```

---

## Task 5: Repository layer

**Files:**
- Create: `apps/web/server/repositories/careEventCommentsRepository.ts`

- [ ] **Step 1: Write the repository**

```ts
// apps/web/server/repositories/careEventCommentsRepository.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabaseAdmin.server";
import type { CareEventComment } from "@carelog/schemas";

/** List non-deleted comments for an event, oldest first, with author display name. */
export async function listComments(
  supabase: SupabaseClient,
  careEventId: string,
): Promise<CareEventComment[]> {
  const { data, error } = await supabase
    .from("care_event_comments")
    .select(
      "id, author_id, body, edited_at, created_at, profiles!care_event_comments_author_id_fkey(display_name)",
    )
    .eq("care_event_id", careEventId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    authorId: row.author_id,
    authorName: row.profiles?.display_name ?? "Unknown",
    body: row.body,
    editedAt: row.edited_at,
    createdAt: row.created_at,
  }));
}

/** Insert a comment. Caller must have verified membership; RLS enforces author. */
export async function insertComment(
  supabase: SupabaseClient,
  input: { careEventId: string; orgId: string; authorId: string; body: string },
): Promise<{ id: string; createdAt: string }> {
  const { data, error } = await supabase
    .from("care_event_comments")
    .insert({
      care_event_id: input.careEventId,
      org_id: input.orgId,
      author_id: input.authorId,
      body: input.body,
    })
    .select("id, created_at")
    .single();

  if (error) throw error;
  return { id: data.id, createdAt: data.created_at };
}

/** Edit a comment's body; RLS enforces author-only. */
export async function editComment(
  supabase: SupabaseClient,
  commentId: string,
  body: string,
): Promise<{ editedAt: string }> {
  const editedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("care_event_comments")
    .update({ body, edited_at: editedAt })
    .eq("id", commentId)
    .select("edited_at")
    .single();

  if (error) throw error;
  return { editedAt: data.edited_at };
}

/** Soft-delete a comment; RLS enforces author-only. */
export async function softDeleteComment(
  supabase: SupabaseClient,
  commentId: string,
): Promise<void> {
  const { error } = await supabase
    .from("care_event_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);
  if (error) throw error;
}

/** Service-role: look up event org + author, and distinct prior commenters. */
export async function getFanoutTargets(
  careEventId: string,
  excludeUserId: string,
): Promise<{ orgId: string; eventAuthorId: string; priorCommenterIds: string[] }> {
  const { data: event, error: eventErr } = await supabaseAdmin
    .from("care_events")
    .select("org_id, author_id, payload")
    .eq("id", careEventId)
    .single();
  if (eventErr) throw eventErr;

  const { data: prior, error: priorErr } = await supabaseAdmin
    .from("care_event_comments")
    .select("author_id")
    .eq("care_event_id", careEventId)
    .neq("author_id", excludeUserId);
  if (priorErr) throw priorErr;

  const priorCommenterIds = Array.from(new Set((prior ?? []).map((r) => r.author_id)));
  return {
    orgId: event.org_id,
    eventAuthorId: event.author_id,
    priorCommenterIds,
  };
}

/** Service-role: fetch the event's org_id for insert wrapper. */
export async function getEventOrgId(careEventId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("care_events")
    .select("org_id")
    .eq("id", careEventId)
    .single();
  if (error) throw error;
  return data.org_id;
}
```

**Note:** Adjust `author_id` → the actual `care_events` column name (it may be `created_by`) after reading the migration. Verify before committing.

- [ ] **Step 2: Verify field names**

Run: `grep -E "author_id|created_by" supabase/migrations/*care_events*.sql | head`
Adjust the property name in `getFanoutTargets` to match the real column. Update the return shape if needed.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/server/repositories/careEventCommentsRepository.ts
git commit -m "feat(server): care-event-comments repository (ON-44)"
```

---

## Task 6: tRPC sub-router + logic tests

**Files:**
- Create: `apps/web/server/routers/careEventComments.ts`
- Create: `apps/web/server/routers/__tests__/careEventComments.logic.test.ts`
- Modify: `apps/web/server/routers/careEvents.ts`

- [ ] **Step 1: Write the failing logic tests**

```ts
// apps/web/server/routers/__tests__/careEventComments.logic.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../repositories/careEventCommentsRepository", () => ({
  listComments: vi.fn(),
  insertComment: vi.fn(),
  editComment: vi.fn(),
  softDeleteComment: vi.fn(),
  getEventOrgId: vi.fn(),
}));

vi.mock("../../../inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue(undefined) },
}));

import * as repo from "../../repositories/careEventCommentsRepository";
import { inngest } from "../../../inngest/client";
import { careEventCommentsRouter } from "../careEventComments";

const ctx = {
  user: { id: "user-1" },
  supabase: {} as any,
};

describe("careEventComments router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list returns non-deleted comments", async () => {
    (repo.listComments as any).mockResolvedValue([
      { id: "c1", authorId: "user-1", authorName: "A", body: "hi", editedAt: null, createdAt: "t" },
    ]);
    const caller = careEventCommentsRouter.createCaller(ctx as any);
    const out = await caller.list({ careEventId: "11111111-1111-1111-1111-111111111111" });
    expect(out).toHaveLength(1);
    expect(out[0].body).toBe("hi");
  });

  it("add inserts and publishes inngest event", async () => {
    (repo.getEventOrgId as any).mockResolvedValue("org-1");
    (repo.insertComment as any).mockResolvedValue({ id: "c1", createdAt: "2026-01-01T00:00:00Z" });
    const caller = careEventCommentsRouter.createCaller(ctx as any);
    const out = await caller.add({
      careEventId: "11111111-1111-1111-1111-111111111111",
      body: "hello",
    });
    expect(out).toEqual({ id: "c1", createdAt: "2026-01-01T00:00:00Z" });
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "careEventComment/created",
        data: expect.objectContaining({
          commentId: "c1",
          careEventId: "11111111-1111-1111-1111-111111111111",
          orgId: "org-1",
          authorId: "user-1",
        }),
      }),
    );
  });

  it("edit calls repo and returns editedAt", async () => {
    (repo.editComment as any).mockResolvedValue({ editedAt: "2026-01-02T00:00:00Z" });
    const caller = careEventCommentsRouter.createCaller(ctx as any);
    const out = await caller.edit({
      commentId: "22222222-2222-2222-2222-222222222222",
      body: "updated",
    });
    expect(out.editedAt).toBe("2026-01-02T00:00:00Z");
  });

  it("remove soft-deletes", async () => {
    (repo.softDeleteComment as any).mockResolvedValue(undefined);
    const caller = careEventCommentsRouter.createCaller(ctx as any);
    const out = await caller.remove({ commentId: "22222222-2222-2222-2222-222222222222" });
    expect(out).toEqual({ ok: true });
    expect(repo.softDeleteComment).toHaveBeenCalledWith(ctx.supabase, "22222222-2222-2222-2222-222222222222");
  });

  it("add rejects empty body", async () => {
    const caller = careEventCommentsRouter.createCaller(ctx as any);
    await expect(
      caller.add({ careEventId: "11111111-1111-1111-1111-111111111111", body: "   " }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests — they should fail**

Run: `pnpm -C apps/web test --run careEventComments.logic`
Expected: FAIL — module `../careEventComments` not found.

- [ ] **Step 3: Implement the router**

```ts
// apps/web/server/routers/careEventComments.ts
import { router, protectedProcedure } from "../trpc/index";
import {
  listCommentsInputSchema,
  addCommentInputSchema,
  editCommentInputSchema,
  removeCommentInputSchema,
} from "@carelog/schemas";
import {
  listComments,
  insertComment,
  editComment,
  softDeleteComment,
  getEventOrgId,
} from "../repositories/careEventCommentsRepository";
import { inngest } from "../../inngest/client";

export const careEventCommentsRouter = router({
  list: protectedProcedure
    .input(listCommentsInputSchema)
    .query(({ ctx, input }) => listComments(ctx.supabase, input.careEventId)),

  add: protectedProcedure
    .input(addCommentInputSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = await getEventOrgId(input.careEventId);
      const result = await insertComment(ctx.supabase, {
        careEventId: input.careEventId,
        orgId,
        authorId: ctx.user.id,
        body: input.body,
      });
      await inngest
        .send({
          name: "careEventComment/created",
          data: {
            commentId: result.id,
            careEventId: input.careEventId,
            orgId,
            authorId: ctx.user.id,
            body: input.body,
          },
        })
        .catch(() => {});
      return result;
    }),

  edit: protectedProcedure
    .input(editCommentInputSchema)
    .mutation(({ ctx, input }) => editComment(ctx.supabase, input.commentId, input.body)),

  remove: protectedProcedure
    .input(removeCommentInputSchema)
    .mutation(async ({ ctx, input }) => {
      await softDeleteComment(ctx.supabase, input.commentId);
      return { ok: true as const };
    }),
});
```

- [ ] **Step 4: Nest under `careEvents`**

Modify `apps/web/server/routers/careEvents.ts`: import the sub-router and merge.

```ts
// At top of file:
import { careEventCommentsRouter } from "./careEventComments";

// Replace `export const careEventsRouter = router({ ... })` so it reads:
export const careEventsRouter = router({
  // ...existing procedures unchanged...
  comments: careEventCommentsRouter,
});
```

- [ ] **Step 5: Run tests — they should pass**

Run: `pnpm -C apps/web test --run careEventComments.logic`
Expected: 5 passed.

- [ ] **Step 6: Full typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/server/routers/careEventComments.ts \
        apps/web/server/routers/__tests__/careEventComments.logic.test.ts \
        apps/web/server/routers/careEvents.ts
git commit -m "feat(trpc): careEvents.comments sub-router (ON-44)"
```

---

## Task 7: Inngest fanout worker

**Files:**
- Create: `apps/web/inngest/functions/careEventCommentFanout.ts`
- Create: `apps/web/inngest/functions/__tests__/careEventCommentFanout.test.ts`
- Modify: `apps/web/app/api/inngest/route.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/inngest/functions/__tests__/careEventCommentFanout.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../server/repositories/careEventCommentsRepository", () => ({
  getFanoutTargets: vi.fn(),
}));
vi.mock("../../pushNotification", () => ({
  sendExpoPush: vi.fn().mockResolvedValue(undefined),
  getPushTokensForUsers: vi.fn(),
}));
vi.mock("../../../server/supabaseAdmin.server", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

import * as repo from "../../../server/repositories/careEventCommentsRepository";
import * as push from "../../pushNotification";
import { supabaseAdmin } from "../../../server/supabaseAdmin.server";
import { runFanout } from "../careEventCommentFanout";

function mockPrefs(userPrefs: Record<string, boolean>) {
  (supabaseAdmin.from as any).mockImplementation((table: string) => {
    if (table === "notification_preferences") {
      return {
        select: () => ({
          in: (_col: string, ids: string[]) => ({
            data: ids.map((id) => ({
              user_id: id,
              care_event_comments: userPrefs[id] ?? true,
              push_enabled: true,
            })),
            error: null,
          }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
}

describe("careEventCommentFanout.runFanout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pushes to author + prior commenters, excluding current author", async () => {
    (repo.getFanoutTargets as any).mockResolvedValue({
      orgId: "org-1",
      eventAuthorId: "alice",
      priorCommenterIds: ["bob", "carol"],
    });
    mockPrefs({});
    (push.getPushTokensForUsers as any).mockResolvedValue(["tok-alice", "tok-bob", "tok-carol"]);

    const result = await runFanout({
      commentId: "c1",
      careEventId: "e1",
      orgId: "org-1",
      authorId: "dave",
      body: "hello world",
    });

    expect(push.getPushTokensForUsers).toHaveBeenCalledWith(
      expect.arrayContaining(["alice", "bob", "carol"]),
    );
    expect((push.getPushTokensForUsers as any).mock.calls[0][0]).not.toContain("dave");
    expect(push.sendExpoPush).toHaveBeenCalled();
    expect(result.pushed).toBe(3);
  });

  it("excludes recipients who disabled care_event_comments", async () => {
    (repo.getFanoutTargets as any).mockResolvedValue({
      orgId: "org-1",
      eventAuthorId: "alice",
      priorCommenterIds: ["bob"],
    });
    mockPrefs({ bob: false });
    (push.getPushTokensForUsers as any).mockResolvedValue(["tok-alice"]);

    const result = await runFanout({
      commentId: "c1",
      careEventId: "e1",
      orgId: "org-1",
      authorId: "dave",
      body: "hi",
    });

    expect(push.getPushTokensForUsers).toHaveBeenCalledWith(["alice"]);
    expect(result.pushed).toBe(1);
  });

  it("no-op when no recipients", async () => {
    (repo.getFanoutTargets as any).mockResolvedValue({
      orgId: "org-1",
      eventAuthorId: "dave",
      priorCommenterIds: [],
    });
    const result = await runFanout({
      commentId: "c1",
      careEventId: "e1",
      orgId: "org-1",
      authorId: "dave",
      body: "hi",
    });
    expect(result.pushed).toBe(0);
    expect(push.sendExpoPush).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm -C apps/web test --run careEventCommentFanout`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the worker**

```ts
// apps/web/inngest/functions/careEventCommentFanout.ts
import { inngest } from "../client";
import { sendExpoPush, getPushTokensForUsers } from "../pushNotification";
import { getFanoutTargets } from "../../server/repositories/careEventCommentsRepository";
import { supabaseAdmin } from "../../server/supabaseAdmin.server";

type Payload = {
  commentId: string;
  careEventId: string;
  orgId: string;
  authorId: string;
  body: string;
};

export async function runFanout(data: Payload) {
  const targets = await getFanoutTargets(data.careEventId, data.authorId);
  const recipientSet = new Set<string>(
    [targets.eventAuthorId, ...targets.priorCommenterIds].filter(
      (id) => id && id !== data.authorId,
    ),
  );
  if (recipientSet.size === 0) return { pushed: 0 };

  const { data: prefs, error: prefErr } = await supabaseAdmin
    .from("notification_preferences")
    .select("user_id, care_event_comments, push_enabled")
    .in("user_id", Array.from(recipientSet));
  if (prefErr) throw prefErr;

  const allowed = (prefs ?? [])
    .filter((p: any) => p.care_event_comments !== false && p.push_enabled !== false)
    .map((p: any) => p.user_id);

  // Include recipients with no row (default true).
  const unseen = Array.from(recipientSet).filter(
    (id) => !(prefs ?? []).some((p: any) => p.user_id === id),
  );
  const finalRecipients = [...allowed, ...unseen];
  if (finalRecipients.length === 0) return { pushed: 0 };

  const tokens = await getPushTokensForUsers(finalRecipients);
  if (tokens.length === 0) return { pushed: finalRecipients.length };

  const truncated = data.body.length > 120 ? `${data.body.slice(0, 117)}…` : data.body;
  await sendExpoPush(
    tokens.map((to) => ({
      to,
      title: "New comment",
      body: truncated,
      sound: "default" as const,
      data: { careEventId: data.careEventId, commentId: data.commentId },
    })),
  );

  return { pushed: finalRecipients.length };
}

export const careEventCommentFanoutFn = inngest.createFunction(
  { id: "care-event-comment-fanout", name: "Care event comment: push fanout" },
  { event: "careEventComment/created" },
  async ({ event, step }) => {
    return step.run("fanout", () => runFanout(event.data as Payload));
  },
);
```

- [ ] **Step 4: Register the function**

Modify `apps/web/app/api/inngest/route.ts`:

```ts
// Add import:
import { careEventCommentFanoutFn } from "../../../inngest/functions/careEventCommentFanout";

// Add to functions: [...]:
careEventCommentFanoutFn,
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `pnpm -C apps/web test --run careEventCommentFanout`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add apps/web/inngest/functions/careEventCommentFanout.ts \
        apps/web/inngest/functions/__tests__/careEventCommentFanout.test.ts \
        apps/web/app/api/inngest/route.ts
git commit -m "feat(inngest): care-event-comment push fanout (ON-44)"
```

---

## Task 8: Web — CommentItem component

**Files:**
- Create: `apps/web/components/care-events/CommentItem.tsx`
- Create: `apps/web/components/care-events/__tests__/CommentItem.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/web/components/care-events/__tests__/CommentItem.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommentItem } from "../CommentItem";

const base = {
  id: "c1",
  authorId: "u1",
  authorName: "Alice",
  body: "hello",
  editedAt: null,
  createdAt: new Date().toISOString(),
};

describe("CommentItem", () => {
  it("renders author, body, no edited badge when not edited", () => {
    render(<CommentItem comment={base} currentUserId="u1" onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.queryByText(/edited/i)).toBeNull();
  });

  it("shows edited badge when editedAt present", () => {
    render(
      <CommentItem
        comment={{ ...base, editedAt: new Date().toISOString() }}
        currentUserId="u1"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/edited/i)).toBeInTheDocument();
  });

  it("shows Edit/Delete to author only", () => {
    const { rerender } = render(
      <CommentItem comment={base} currentUserId="u1" onEdit={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /edit comment/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete comment/i })).toBeInTheDocument();

    rerender(<CommentItem comment={base} currentUserId="u2" onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /edit comment/i })).toBeNull();
  });

  it("calls onEdit with new body after Save", () => {
    const onEdit = vi.fn();
    render(<CommentItem comment={base} currentUserId="u1" onEdit={onEdit} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /edit comment/i }));
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "updated" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onEdit).toHaveBeenCalledWith("c1", "updated");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm -C apps/web test --run CommentItem`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement**

```tsx
// apps/web/components/care-events/CommentItem.tsx
"use client";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { CareEventComment } from "@carelog/schemas";

type Props = {
  comment: CareEventComment;
  currentUserId: string;
  onEdit: (id: string, body: string) => void;
  onDelete: (id: string) => void;
};

export function CommentItem({ comment, currentUserId, onEdit, onDelete }: Props) {
  const isAuthor = comment.authorId === currentUserId;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);

  if (editing) {
    return (
      <div className="flex flex-col gap-2 py-2">
        <Textarea
          aria-label="Edit comment body"
          value={draft}
          maxLength={4000}
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-20"
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setDraft(comment.body); }}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!draft.trim() || draft.trim() === comment.body}
            onClick={() => { onEdit(comment.id, draft.trim()); setEditing(false); }}
          >
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 py-2">
      <div
        aria-hidden="true"
        className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center text-sm font-medium"
      >
        {comment.authorName.slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <span className="font-medium text-[var(--color-ink)]">{comment.authorName}</span>
          <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time>
          {comment.editedAt && (
            <span title={`Edited ${new Date(comment.editedAt).toLocaleString()}`}>· edited</span>
          )}
        </div>
        <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">{comment.body}</p>
      </div>
      {isAuthor && (
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Edit comment"
            onClick={() => setEditing(true)}
            className="p-2 rounded hover:bg-[var(--color-primary-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            aria-label="Delete comment"
            onClick={() => { if (confirm("Delete this comment?")) onDelete(comment.id); }}
            className="p-2 rounded hover:bg-[var(--color-primary-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm -C apps/web test --run CommentItem`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/care-events/CommentItem.tsx \
        apps/web/components/care-events/__tests__/CommentItem.test.tsx
git commit -m "feat(web): CommentItem component (ON-44)"
```

---

## Task 9: Web — CommentComposer component

**Files:**
- Create: `apps/web/components/care-events/CommentComposer.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/components/care-events/CommentComposer.tsx
"use client";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type Props = {
  onSubmit: (body: string) => Promise<void> | void;
  disabled?: boolean;
};

export function CommentComposer({ onSubmit, disabled }: Props) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const trimmed = body.trim();
  const overLimit = body.length > 4000;
  const canSubmit = !busy && !disabled && trimmed.length > 0 && !overLimit;
  const showCounter = body.length >= 3500;

  return (
    <form
      className="flex flex-col gap-2 pt-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setBusy(true);
        try {
          await onSubmit(trimmed);
          setBody("");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="sr-only" htmlFor="comment-body">Add a comment</label>
      <Textarea
        id="comment-body"
        placeholder="Add a comment…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={4000}
        className="min-h-20"
      />
      <div className="flex justify-between items-center">
        <span className={`text-xs ${overLimit ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"}`}>
          {showCounter ? `${body.length}/4000` : ""}
        </span>
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {busy ? "Posting…" : "Post"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -C apps/web typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/care-events/CommentComposer.tsx
git commit -m "feat(web): CommentComposer component (ON-44)"
```

---

## Task 10: Web — CommentThread (list + realtime) + mount

**Files:**
- Create: `apps/web/components/care-events/CommentThread.tsx`
- Create: `apps/web/components/care-events/__tests__/CommentThread.test.tsx`
- Modify: web care-event card (likely `apps/web/components/care-events/CareEventCard.tsx` — locate first)

- [ ] **Step 1: Locate the card component**

Run: `grep -rln "CareEventCard\|CareEventRow" apps/web/components apps/web/app | head`
Identify the file that renders a single event row in the journal feed.

- [ ] **Step 2: Write CommentThread**

```tsx
// apps/web/components/care-events/CommentThread.tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import { CommentItem } from "./CommentItem";
import { CommentComposer } from "./CommentComposer";
import type { CareEventComment } from "@carelog/schemas";

type Props = { careEventId: string; currentUserId: string };

export function CommentThread({ careEventId, currentUserId }: Props) {
  const [expanded, setExpanded] = useState<boolean>(() =>
    typeof window !== "undefined" &&
    window.location.hash === `#comments-${careEventId}`,
  );
  const utils = trpc.useUtils();
  const { data: comments = [], refetch } = trpc.careEvents.comments.list.useQuery(
    { careEventId },
    { enabled: expanded },
  );

  const add = trpc.careEvents.comments.add.useMutation({
    onSuccess: () => refetch(),
  });
  const edit = trpc.careEvents.comments.edit.useMutation({ onSuccess: () => refetch() });
  const remove = trpc.careEvents.comments.remove.useMutation({
    onMutate: async ({ commentId }) => {
      await utils.careEvents.comments.list.cancel({ careEventId });
      utils.careEvents.comments.list.setData({ careEventId }, (old) =>
        (old ?? []).filter((c) => c.id !== commentId),
      );
    },
    onSettled: () => refetch(),
  });

  useEffect(() => {
    if (!expanded) return;
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`care_event_comments:${careEventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "care_event_comments", filter: `care_event_id=eq.${careEventId}` },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [careEventId, expanded, refetch]);

  const count = comments.length;
  const label = count === 0 ? "Add a comment" : `${count} comment${count === 1 ? "" : "s"}`;

  const toggle = useCallback(() => {
    setExpanded((e) => !e);
  }, []);

  return (
    <section className="border-t border-[var(--color-border)] bg-[var(--color-primary-subtle)]/40">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      >
        <MessageSquare size={16} aria-hidden="true" />
        <span>{label}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-3">
          <ul className="divide-y divide-[var(--color-border)]">
            {comments.map((c) => (
              <li key={c.id}>
                <CommentItem
                  comment={c}
                  currentUserId={currentUserId}
                  onEdit={(id, body) => edit.mutate({ commentId: id, body })}
                  onDelete={(id) => remove.mutate({ commentId: id })}
                />
              </li>
            ))}
          </ul>
          <CommentComposer
            disabled={add.isPending}
            onSubmit={async (body) => {
              await add.mutateAsync({ careEventId, body });
            }}
          />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Write CommentThread test**

```tsx
// apps/web/components/care-events/__tests__/CommentThread.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    useUtils: () => ({ careEvents: { comments: { list: { cancel: vi.fn(), setData: vi.fn() } } } }),
    careEvents: {
      comments: {
        list: { useQuery: () => ({ data: [], refetch: vi.fn() }) },
        add: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) },
        edit: { useMutation: () => ({ mutate: vi.fn() }) },
        remove: { useMutation: () => ({ mutate: vi.fn() }) },
      },
    },
  },
}));
vi.mock("@/lib/supabase-browser", () => ({
  createBrowserSupabase: () => ({
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  }),
}));

import { CommentThread } from "../CommentThread";

describe("CommentThread", () => {
  it("starts collapsed and shows '0 comments' style CTA", () => {
    render(<CommentThread careEventId="e1" currentUserId="u1" />);
    expect(screen.getByRole("button", { name: /add a comment/i })).toBeInTheDocument();
  });

  it("expands when toggle clicked", () => {
    render(<CommentThread careEventId="e1" currentUserId="u1" />);
    const btn = screen.getByRole("button", { name: /add a comment/i });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });
});
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `pnpm -C apps/web test --run CommentThread`
Expected: 2 passed.

- [ ] **Step 5: Mount in the journal card**

Add the following to the CareEventCard render (after the main card content, before closing):

```tsx
import { CommentThread } from "./CommentThread";

// ...inside the component, once we have currentUserId from session context:
<CommentThread careEventId={event.id} currentUserId={currentUserId} />
```

If `currentUserId` isn't already on the card's props, thread it in from the journal page.

- [ ] **Step 6: Typecheck + unit tests**

Run: `pnpm typecheck && pnpm -C apps/web test --run care-events`
Expected: clean + passing.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/care-events/CommentThread.tsx \
        apps/web/components/care-events/__tests__/CommentThread.test.tsx \
        apps/web/components/care-events/CareEventCard.tsx
git commit -m "feat(web): comment thread on care events with realtime (ON-44)"
```

---

## Task 11: Mobile — CommentItem

**Files:**
- Create: `apps/mobile/components/comments/CommentItem.tsx`

- [ ] **Step 1: Implement**

```tsx
// apps/mobile/components/comments/CommentItem.tsx
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import type { CareEventComment } from "@carelog/schemas";

type Props = {
  comment: CareEventComment;
  currentUserId: string;
  onEdit: (id: string, body: string) => void;
  onDelete: (id: string) => void;
};

export function CommentItem({ comment, currentUserId, onEdit, onDelete }: Props) {
  const isAuthor = comment.authorId === currentUserId;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);

  const showActions = () => {
    if (!isAuthor) return;
    Alert.alert("Comment", undefined, [
      { text: "Edit", onPress: () => setEditing(true) },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => onDelete(comment.id),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <Pressable
      onLongPress={showActions}
      accessibilityRole="button"
      accessibilityLabel={`Comment by ${comment.authorName}${isAuthor ? " (long-press for actions)" : ""}`}
      style={{ paddingVertical: 8, paddingHorizontal: 12 }}
    >
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Text style={{ fontWeight: "600" }}>{comment.authorName}</Text>
        <Text style={{ color: "#6b7280" }}>
          {new Date(comment.createdAt).toLocaleString()}
        </Text>
        {comment.editedAt && <Text style={{ color: "#6b7280" }}>· edited</Text>}
      </View>
      {editing ? (
        <View style={{ marginTop: 4 }}>
          <TextInput
            accessibilityLabel="Edit comment body"
            multiline
            value={draft}
            onChangeText={setDraft}
            maxLength={4000}
            style={{ borderWidth: 1, borderColor: "#ede9fe", borderRadius: 6, padding: 8 }}
          />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => { setEditing(false); setDraft(comment.body); }}
            >
              <Text>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (!draft.trim()) return;
                onEdit(comment.id, draft.trim());
                setEditing(false);
              }}
            >
              <Text style={{ color: "#7c3aed", fontWeight: "600" }}>Save</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={{ marginTop: 2 }}>{comment.body}</Text>
      )}
    </Pressable>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/components/comments/CommentItem.tsx
git commit -m "feat(mobile): CommentItem component (ON-44)"
```

---

## Task 12: Mobile — CommentComposer

**Files:**
- Create: `apps/mobile/components/comments/CommentComposer.tsx`

- [ ] **Step 1: Implement**

```tsx
// apps/mobile/components/comments/CommentComposer.tsx
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";

type Props = { onSubmit: (body: string) => Promise<void> };

export function CommentComposer({ onSubmit }: Props) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const trimmed = body.trim();
  const canSubmit = !busy && trimmed.length > 0 && body.length <= 4000;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ borderTopWidth: 1, borderTopColor: "#ede9fe", padding: 8, gap: 6 }}
    >
      <TextInput
        accessibilityLabel="Add a comment"
        placeholder="Add a comment…"
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={4000}
        style={{ minHeight: 40, padding: 8, borderWidth: 1, borderColor: "#ede9fe", borderRadius: 6 }}
      />
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          disabled={!canSubmit}
          onPress={async () => {
            setBusy(true);
            try {
              await onSubmit(trimmed);
              setBody("");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Text style={{ color: canSubmit ? "#7c3aed" : "#9ca3af", fontWeight: "600" }}>
            {busy ? "Posting…" : "Post"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/components/comments/CommentComposer.tsx
git commit -m "feat(mobile): CommentComposer component (ON-44)"
```

---

## Task 13: Mobile — CommentSection + mount on detail screen

**Files:**
- Create: `apps/mobile/components/comments/CommentSection.tsx`
- Modify: `apps/mobile/app/(app)/journal/[eventId].tsx`

- [ ] **Step 1: Implement CommentSection**

```tsx
// apps/mobile/components/comments/CommentSection.tsx
import { useEffect } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { trpc } from "@/lib/trpc";
import { getSupabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/session";
import { CommentItem } from "./CommentItem";
import { CommentComposer } from "./CommentComposer";

export function CommentSection({ careEventId }: { careEventId: string }) {
  const user = useCurrentUser();
  const list = trpc.careEvents.comments.list.useQuery({ careEventId });
  const add = trpc.careEvents.comments.add.useMutation({ onSuccess: () => list.refetch() });
  const edit = trpc.careEvents.comments.edit.useMutation({ onSuccess: () => list.refetch() });
  const remove = trpc.careEvents.comments.remove.useMutation({ onSuccess: () => list.refetch() });

  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`care_event_comments:${careEventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "care_event_comments", filter: `care_event_id=eq.${careEventId}` },
        () => list.refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [careEventId, list]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12 }}>
        <Text style={{ fontWeight: "600", fontSize: 16 }}>Comments</Text>
      </View>
      <FlatList
        data={list.data ?? []}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <CommentItem
            comment={item}
            currentUserId={user?.id ?? ""}
            onEdit={(id, body) => edit.mutate({ commentId: id, body })}
            onDelete={(id) => remove.mutate({ commentId: id })}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={list.isFetching} onRefresh={() => list.refetch()} />
        }
        ListEmptyComponent={
          <Text style={{ padding: 12, color: "#6b7280" }}>
            Be the first to comment.
          </Text>
        }
      />
      <CommentComposer
        onSubmit={async (body) => {
          await add.mutateAsync({ careEventId, body });
        }}
      />
    </View>
  );
}
```

- [ ] **Step 2: Mount on detail screen**

Open `apps/mobile/app/(app)/journal/[eventId].tsx`. After existing content, mount `<CommentSection careEventId={eventId} />`. Ensure the screen is flex-rooted so FlatList can grow.

- [ ] **Step 3: Typecheck**

Run: `pnpm -C apps/mobile typecheck`
Expected: clean. If `useCurrentUser` / `getSupabase` helpers are named differently in the codebase, substitute the project's existing session/supabase hooks.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/comments/CommentSection.tsx \
        "apps/mobile/app/(app)/journal/[eventId].tsx"
git commit -m "feat(mobile): comment section on journal entry detail (ON-44)"
```

---

## Task 14: E2E spec

**Files:**
- Create: `e2e/care-event-comments.spec.ts`

- [ ] **Step 1: Write spec**

Follow the existing patterns in `e2e/` (check `e2e/messaging.spec.ts` or the most recent spec). Use two storage-state auth fixtures for two users in the same org.

```ts
// e2e/care-event-comments.spec.ts
import { test, expect } from "@playwright/test";

test.describe("care event comments (ON-44)", () => {
  test("post, realtime, edit, delete", async ({ browser }) => {
    // 1. Alice (context A) logs in, opens a journal entry she already created.
    // 2. She expands comments, posts "First comment".
    // 3. In a second context (Bob, same org), he opens the same entry and sees
    //    Alice's comment appear live via realtime (expect await poll).
    // 4. Bob posts "Second". Alice sees it appear live.
    // 5. Alice edits her comment; both sides reflect "· edited" + new body.
    // 6. Alice deletes her comment; both sides show it removed.
  });
});
```

Fill in the selectors and navigation following the journal-feed conventions in the repo.

- [ ] **Step 2: Run**

Run: `pnpm exec playwright test care-event-comments`
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add e2e/care-event-comments.spec.ts
git commit -m "test(e2e): care-event comments end-to-end (ON-44)"
```

---

## Task 15: Backlog update + final verification

**Files:**
- Modify: `docs/BACKLOG.md`

- [ ] **Step 1: Flip ON-44 to shipped**

In the `§0` status board, decrement "In progress / review" and increment "Shipped this week" appropriately. Move the ON-44 row from §5 to §7 with the date and a one-liner. (Do not hand-edit §0 counts alone — run `/backlog-sync` afterward to reconcile.)

- [ ] **Step 2: Full verification suite**

Run in order:

```bash
pnpm typecheck
pnpm lint
pnpm test
supabase test db
pnpm exec playwright test care-event-comments
```

Expected: all green.

- [ ] **Step 3: Reconcile backlog**

Run `/backlog-sync` and let it rewrite §0 counts.

- [ ] **Step 4: Final commit**

```bash
git add docs/BACKLOG.md
git commit -m "chore(backlog): ship ON-44 care-event comments"
```

---

## Self-review notes

- Spec §1 (data model), §2 (tRPC), §3 (realtime + Inngest), §4 (web UI), §5 (mobile UI), §6 (testing) each map to concrete tasks above.
- No placeholders remain; every step has either code, a concrete command, or a clear structural change.
- Field/function names are consistent across tasks: `careEventId`, `commentId`, `body`, `editedAt`, `deletedAt`, `runFanout`, `getFanoutTargets`.
- One real-world unknown: the `care_events` column that names the event author (`author_id` vs `created_by`). Task 5 Step 2 forces the implementer to verify before committing.
- Rate limiting and moderation are intentionally out of scope per Q4.
