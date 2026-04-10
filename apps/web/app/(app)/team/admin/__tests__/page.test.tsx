import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import TeamAdminPage from "../page";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        not: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  })),
};

vi.mock("@/lib/supabase", () => ({
  createClient: () => mockSupabase,
}));

describe("TeamAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });
  });

  it("redirects to /signin when no user", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    const { unmount } = render(<TeamAdminPage />);
    await waitFor(() => {
      expect(window.location.href).toContain("/signin");
    });
    unmount();
  });

  it("renders page heading when coordinator", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        members: [{ user_id: "user-1", role: "coordinator", display_name: "Alex", email: "a@b.com" }],
      }),
    });
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          not: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { org_id: "org-1", role: "coordinator" },
            }),
          })),
        })),
      })),
    });
    render(<TeamAdminPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /team admin/i })).toBeInTheDocument();
    });
  });
});
