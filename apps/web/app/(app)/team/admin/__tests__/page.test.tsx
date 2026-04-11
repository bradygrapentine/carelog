import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { TeamAdminClient } from "../TeamAdminClient";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("TeamAdminClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page heading when members load", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        members: [
          {
            id: "m-1",
            user_id: "user-1",
            role: "coordinator",
            display_name: "Alex",
            email: "a@b.com",
          },
        ],
      }),
    });
    render(<TeamAdminClient orgId="org-1" userId="user-1" />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /team admin/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders role badge for coordinator member", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        members: [
          {
            id: "m-1",
            user_id: "user-1",
            role: "coordinator",
            display_name: "Alex",
            email: "a@b.com",
          },
        ],
      }),
    });
    render(<TeamAdminClient orgId="org-1" userId="user-1" />);
    await waitFor(() => {
      expect(screen.getByText("Alex")).toBeInTheDocument();
    });
  });

  it("does not show Remove button for coordinator", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        members: [
          {
            id: "m-1",
            user_id: "user-1",
            role: "coordinator",
            display_name: "Alex",
            email: "a@b.com",
          },
        ],
      }),
    });
    render(<TeamAdminClient orgId="org-1" userId="user-1" />);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /remove/i })).toBeNull();
    });
  });
});
