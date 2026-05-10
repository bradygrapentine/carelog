import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRecipientPreferences } from "../recipientsRepository";

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const RECIPIENT_ID = "22222222-2222-2222-2222-222222222222";

function makeClient(result: { data: unknown; error: unknown }): SupabaseClient {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  return {
    from: vi.fn().mockReturnValue(chain),
  } as unknown as SupabaseClient;
}

describe("getRecipientPreferences", () => {
  it("returns parsed likes + dislikes when jsonb has both arrays", async () => {
    const client = makeClient({
      data: {
        preferences: { likes: ["coffee", "jazz"], dislikes: ["loud"] },
      },
      error: null,
    });
    const result = await getRecipientPreferences(client, ORG_ID, RECIPIENT_ID);
    expect(result).toEqual({
      likes: ["coffee", "jazz"],
      dislikes: ["loud"],
    });
  });

  it("defaults to empty arrays when preferences jsonb is empty {}", async () => {
    const client = makeClient({
      data: { preferences: {} },
      error: null,
    });
    const result = await getRecipientPreferences(client, ORG_ID, RECIPIENT_ID);
    expect(result).toEqual({ likes: [], dislikes: [] });
  });

  it("defaults to empty arrays when only one key is present", async () => {
    const client = makeClient({
      data: { preferences: { likes: ["x"] } },
      error: null,
    });
    const result = await getRecipientPreferences(client, ORG_ID, RECIPIENT_ID);
    expect(result).toEqual({ likes: ["x"], dislikes: [] });
  });

  it("returns empty arrays when preferences shape is malformed (does NOT throw)", async () => {
    const client = makeClient({
      data: { preferences: { likes: "not-an-array" } },
      error: null,
    });
    const result = await getRecipientPreferences(client, ORG_ID, RECIPIENT_ID);
    expect(result).toEqual({ likes: [], dislikes: [] });
  });

  it("returns empty arrays when RLS scopes the row out (no error, no data)", async () => {
    // Defense-in-depth: a non-member of the org gets a 0-row result via RLS.
    // The function returns empty defaults instead of leaking another org's preferences.
    const client = makeClient({ data: null, error: null });
    const result = await getRecipientPreferences(client, ORG_ID, RECIPIENT_ID);
    expect(result).toEqual({ likes: [], dislikes: [] });
  });

  it("throws when the DB query errors", async () => {
    const client = makeClient({
      data: null,
      error: { message: "boom" },
    });
    await expect(
      getRecipientPreferences(client, ORG_ID, RECIPIENT_ID),
    ).rejects.toThrow(/getRecipientPreferences failed: boom/);
  });
});
