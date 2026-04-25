// Integration test: aide cross-recipient tRPC scoping (TD-27).
//
// Spins up real local Supabase (must be running via `supabase start`) and
// exercises the careEvents tRPC router as an actual signed-in user. RLS
// already covers DB-layer isolation; this test pins the tRPC layer so that
// future router refactors can't accidentally widen access.
//
// Note: the spec uses `careEvents.list` but the procedure is named `timeline`.
// We test what the router actually exports.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Local Supabase defaults — overridable via env for CI.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz";
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

// Set env so supabaseAdmin.server picks up the local instance when imported.
process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;

// Import AFTER env is set — supabaseAdmin is a lazy proxy keyed on env.
const { appRouter } = await import("@/server/trpc/router");

// Admin client (service role) used purely for seeding fixtures.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type SeededUser = {
  id: string;
  email: string;
  password: string;
};

type Fixture = {
  orgA: string;
  orgB: string;
  recipientA: string;
  recipientB: string;
  aide: SeededUser; // member of orgA / recipientA only
  coordinator: SeededUser; // coordinator of orgA (full org access)
  // Pre-seeded events so positive controls have something to find.
  eventInA: string;
  eventInB: string;
};

// Tag used to identify and clean up rows this test created. Using a
// per-run UUID keeps tests isolated even if a prior crash left rows behind.
const RUN_TAG = `td27-${randomUUID()}`;

let fixture: Fixture;

async function seedUser(label: string): Promise<SeededUser> {
  // UUID-only identifier in the local-part — no PHI. Domain is example.test.
  const id = randomUUID();
  const email = `${label}-${id}@example.test`;
  const password = `td27-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createUser(${label}) failed: ${error?.message}`);
  }
  return { id: data.user.id, email, password };
}

async function seedOrgWithRecipient(name: string): Promise<{
  orgId: string;
  recipientId: string;
}> {
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name: `${RUN_TAG}-${name}`, org_type: "family" })
    .select("id")
    .single();
  if (orgErr || !org) throw new Error(`org seed failed: ${orgErr?.message}`);

  const { data: vault, error: vaultErr } = await admin
    .from("identity_vault")
    .insert({ org_id: org.id, full_name: `${RUN_TAG}-${name}-recipient` })
    .select("token")
    .single();
  if (vaultErr || !vault)
    throw new Error(`vault seed failed: ${vaultErr?.message}`);

  const { data: recipient, error: recErr } = await admin
    .from("care_recipients")
    .insert({ org_id: org.id, identity_token: vault.token })
    .select("id")
    .single();
  if (recErr || !recipient)
    throw new Error(`recipient seed failed: ${recErr?.message}`);

  return { orgId: org.id, recipientId: recipient.id };
}

async function seedMembership(args: {
  orgId: string;
  userId: string;
  recipientId: string | null;
  role: "aide" | "coordinator" | "family";
}) {
  const { error } = await admin.from("memberships").insert({
    org_id: args.orgId,
    user_id: args.userId,
    recipient_id: args.recipientId,
    role: args.role,
    accepted_at: new Date().toISOString(),
  });
  if (error)
    throw new Error(`membership seed failed (${args.role}): ${error.message}`);
}

async function seedCareEvent(args: {
  orgId: string;
  recipientId: string;
  actorId: string;
}): Promise<string> {
  const { data, error } = await admin
    .from("care_events")
    .insert({
      org_id: args.orgId,
      recipient_id: args.recipientId,
      actor_id: args.actorId,
      event_type: "journal",
      entry_kind: "human",
      payload: { text: `${RUN_TAG} seeded event` },
    })
    .select("id")
    .single();
  if (error || !data)
    throw new Error(`event seed failed: ${error?.message}`);
  return data.id;
}

async function userClient(user: SeededUser): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error)
    throw new Error(`signIn(${user.email}) failed: ${error.message}`);
  return client;
}

beforeAll(async () => {
  // Sanity: ensure local Supabase is reachable. Fail fast with a useful
  // message rather than dumping a fetch error on each test.
  const probe = await fetch(`${SUPABASE_URL}/auth/v1/health`).catch(
    () => null,
  );
  if (!probe || !probe.ok) {
    throw new Error(
      `Local Supabase not reachable at ${SUPABASE_URL}. Run \`supabase start\`.`,
    );
  }

  const [a, b, aide, coordinator] = await Promise.all([
    seedOrgWithRecipient("orgA"),
    seedOrgWithRecipient("orgB"),
    seedUser("aide"),
    seedUser("coord"),
  ]);

  // Aide: orgA / recipientA only. NOT a member of orgB.
  await seedMembership({
    orgId: a.orgId,
    userId: aide.id,
    recipientId: a.recipientId,
    role: "aide",
  });
  // Coordinator: orgA, no recipient_id (full org access — matches
  // production seed pattern where coordinators carry recipient_id = NULL).
  await seedMembership({
    orgId: a.orgId,
    userId: coordinator.id,
    recipientId: null,
    role: "coordinator",
  });

  const eventInA = await seedCareEvent({
    orgId: a.orgId,
    recipientId: a.recipientId,
    actorId: coordinator.id,
  });
  const eventInB = await seedCareEvent({
    orgId: b.orgId,
    recipientId: b.recipientId,
    actorId: coordinator.id, // actor not asserted — RLS only checks reader's membership
  });

  fixture = {
    orgA: a.orgId,
    orgB: b.orgId,
    recipientA: a.recipientId,
    recipientB: b.recipientId,
    aide,
    coordinator,
    eventInA,
    eventInB,
  };
}, 30_000);

afterAll(async () => {
  if (!fixture) return;
  // Cascade cleanup — care_events / memberships / recipients / vault all
  // ON DELETE CASCADE off organizations, so deleting the orgs is enough.
  // Users are deleted separately (auth.users isn't FK'd to organizations).
  await admin.from("organizations").delete().eq("id", fixture.orgA);
  await admin.from("organizations").delete().eq("id", fixture.orgB);
  await admin.auth.admin.deleteUser(fixture.aide.id).catch(() => {});
  await admin.auth.admin.deleteUser(fixture.coordinator.id).catch(() => {});
});

// ─── tests ────────────────────────────────────────────────────────────────────

describe("careEvents router — aide cross-recipient scoping (TD-27)", () => {
  it("Case A: aide of recipient A querying timeline for recipient B returns empty", async () => {
    const supabase = await userClient(fixture.aide);
    const caller = appRouter.createCaller({
      user: { id: fixture.aide.id, email: fixture.aide.email } as never,
      supabase: supabase as never,
      req: undefined,
    });

    const result = await caller.careEvents.timeline({
      recipientId: fixture.recipientB,
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
    // Specifically: the seeded eventInB must not leak.
    expect(result.find((e: { id: string }) => e.id === fixture.eventInB)).toBeUndefined();
  });

  it("Case B: aide of recipient A inserting an event for recipient B is rejected and writes nothing", async () => {
    const supabase = await userClient(fixture.aide);
    const caller = appRouter.createCaller({
      user: { id: fixture.aide.id, email: fixture.aide.email } as never,
      supabase: supabase as never,
      req: undefined,
    });

    // Snapshot count of events for recipient B before the call so we can
    // confirm no row was written even if the router didn't throw.
    const before = await admin
      .from("care_events")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", fixture.recipientB);
    const beforeCount = before.count ?? 0;

    let threw = false;
    try {
      await caller.careEvents.insert({
        orgId: fixture.orgB,
        recipientId: fixture.recipientB,
        eventType: "journal",
        entryKind: "human",
        payload: { text: `${RUN_TAG} should not land` },
      });
    } catch {
      threw = true;
    }

    const after = await admin
      .from("care_events")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", fixture.recipientB);
    const afterCount = after.count ?? 0;

    // Whether the router throws or the DB silently rejects, the row count
    // for recipient B must not have grown.
    expect(afterCount).toBe(beforeCount);
    // And we expect at least one of the two layers to have refused.
    expect(threw).toBe(true);
  });

  it("Case C (positive control): aide querying timeline for recipient A sees the seeded event", async () => {
    const supabase = await userClient(fixture.aide);
    const caller = appRouter.createCaller({
      user: { id: fixture.aide.id, email: fixture.aide.email } as never,
      supabase: supabase as never,
      req: undefined,
    });

    const result = await caller.careEvents.timeline({
      recipientId: fixture.recipientA,
    });

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((e: { id: string }) => e.id === fixture.eventInA)).toBe(true);
  });

  it("Case D (positive control): coordinator of org A sees recipient A's events", async () => {
    const supabase = await userClient(fixture.coordinator);
    const caller = appRouter.createCaller({
      user: {
        id: fixture.coordinator.id,
        email: fixture.coordinator.email,
      } as never,
      supabase: supabase as never,
      req: undefined,
    });

    const result = await caller.careEvents.timeline({
      recipientId: fixture.recipientA,
    });

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((e: { id: string }) => e.id === fixture.eventInA)).toBe(true);
  });
});
