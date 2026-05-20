import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";

// --- Mocks (vitest hoists vi.mock; only `mock`-prefixed vars referenced) ---
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => mockToastError(...a), success: vi.fn() },
}));

const mockAuthFetch = vi.fn();
vi.mock("../../lib/authenticatedFetch", () => ({
  authenticatedFetch: (...a: unknown[]) => mockAuthFetch(...a),
}));

// Supabase client: care_recipients.single() → org; display_names.order() → []
const mockDisplayNamesResult = { data: [], error: null };
vi.mock("../../lib/supabase", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "care_recipients") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  org_id: "org-1",
                  organizations: { id: "org-1", name: "Org" },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      // display_names (loadRecipients)
      return {
        select: () => ({
          eq: () => ({
            order: vi.fn().mockResolvedValue(mockDisplayNamesResult),
          }),
        }),
      };
    },
  }),
}));

import { useJournalData } from "../useJournalData";

const USER = { id: "user-1" } as User;

describe("useJournalData — TD-206 loadMembers error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toasts a generic error when /api/members responds !ok (was silent)", async () => {
    mockAuthFetch.mockImplementation((url: string) => {
      if (url.includes("/api/members")) {
        return Promise.resolve({ ok: false, json: async () => ({}) });
      }
      // loadEvents
      return Promise.resolve({
        ok: true,
        json: async () => ({ events: [], hasMore: false }),
      });
    });

    renderHook(() => useJournalData("rec-1", USER));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Couldn't load the care team — please refresh.",
      );
    });
    // PHI sentinel: no member identity in the toast.
    const msg = String(mockToastError.mock.calls[0]?.[0] ?? "");
    expect(msg).not.toMatch(/@|user-1/);
  });

  it("does not error-toast when /api/members responds ok", async () => {
    mockAuthFetch.mockImplementation((url: string) => {
      if (url.includes("/api/members")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ members: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ events: [], hasMore: false }),
      });
    });

    const { result } = renderHook(() => useJournalData("rec-1", USER));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockToastError).not.toHaveBeenCalled();
  });
});

describe("useJournalData — TD-216 loadEvents error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toasts a generic error when /api/journal responds !ok (was silent)", async () => {
    mockAuthFetch.mockImplementation((url: string) => {
      if (url.includes("/api/journal")) {
        return Promise.resolve({ ok: false, json: async () => ({}) });
      }
      // loadMembers / others succeed so only the timeline toast fires
      return Promise.resolve({ ok: true, json: async () => ({ members: [] }) });
    });

    renderHook(() => useJournalData("rec-1", USER));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Couldn't load the timeline — please refresh.",
      );
    });
    // PHI sentinel: no recipient/journal identity in the toast.
    const msg = String(mockToastError.mock.calls[0]?.[0] ?? "");
    expect(msg).not.toMatch(/@|user-1|rec-1/);
  });

  it("does not error-toast when /api/journal responds ok", async () => {
    mockAuthFetch.mockImplementation((url: string) => {
      if (url.includes("/api/journal")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ events: [], hasMore: false }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ members: [] }) });
    });

    const { result } = renderHook(() => useJournalData("rec-1", USER));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockToastError).not.toHaveBeenCalled();
  });
});
