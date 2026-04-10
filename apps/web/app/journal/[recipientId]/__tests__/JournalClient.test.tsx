import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { JournalClient } from "../JournalClient";

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "u1", email: "test@example.com" } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          org_id: "org1",
          organizations: { id: "org1", name: "Test Org" },
        },
      }),
    }),
  }),
}));

vi.mock("@/lib/authenticatedFetch", () => ({
  authenticatedFetch: vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ events: [], members: [] }),
  }),
}));

describe("JournalClient layout", () => {
  it("renders sidebar rail after loading", async () => {
    render(<JournalClient recipientId="r1" />);
    await waitFor(
      () => {
        expect(screen.getByTestId("sidebar-rail")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("renders the top bar after loading", async () => {
    render(<JournalClient recipientId="r1" />);
    await waitFor(
      () => {
        expect(screen.getByTestId("top-bar")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});
