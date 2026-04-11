import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import InvitePage from "../page";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

const mockAuthenticatedFetch = vi.fn();
vi.mock("@/lib/authenticatedFetch", () => ({
  get authenticatedFetch() {
    return mockAuthenticatedFetch;
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOKEN = "test-token-abc";

// Pass an already-resolved thenable so React.use() resolves synchronously
function resolvedPromise<T>(val: T): Promise<T> {
  const p = Promise.resolve(val);
  // React.use() checks .status on the thenable for sync resolution
  (p as any).status = "fulfilled";
  (p as any).value = val;
  return p;
}

function renderPage(token = TOKEN) {
  return render(
    <Suspense fallback={null}>
      <InvitePage params={resolvedPromise({ token })} />
    </Suspense>,
  );
}

function mockValidInvite() {
  global.fetch = vi.fn().mockResolvedValue({
    json: async () => ({
      email: "invited@example.com",
      orgName: "Smith Family",
      role: "caregiver",
    }),
  });
}

function mockInvalidInvite() {
  global.fetch = vi.fn().mockResolvedValue({
    json: async () => ({ error: "Invite not found or has expired." }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Reset window.location
  Object.defineProperty(window, "location", {
    writable: true,
    value: { href: "" },
  });
  // Clear sessionStorage
  sessionStorage.clear();
});

describe("InvitePage", () => {
  it("shows invite details (org name and role) when token is valid", async () => {
    mockValidInvite();
    mockGetUser.mockResolvedValue({ data: { user: null } });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Smith Family")).toBeInTheDocument();
    });

    expect(screen.getByText("Caregiver")).toBeInTheDocument();
    expect(screen.getByText("invited@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Accept invitation" }),
    ).toBeInTheDocument();
  });

  it("calls POST /api/invite/[token]/accept when accept button is clicked by authenticated user", async () => {
    mockValidInvite();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "invited@example.com" } },
    });
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    renderPage();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Accept invitation" }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/invite/" + TOKEN + "/accept",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("redirects to /dashboard after successful acceptance", async () => {
    mockValidInvite();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "invited@example.com" } },
    });
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    renderPage();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Accept invitation" }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));

    // Wait for "done" state to render
    await waitFor(() => {
      expect(screen.getByText("You have joined the team")).toBeInTheDocument();
    });

    // The component schedules a setTimeout(2000) redirect.
    // Wait for window.location.href to be set.
    await waitFor(
      () => {
        expect(window.location.href).toBe("/dashboard");
      },
      { timeout: 3000 },
    );
  });

  it("shows error state for invalid or expired token", async () => {
    mockInvalidInvite();
    mockGetUser.mockResolvedValue({ data: { user: null } });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Invite not found")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Invite not found or has expired."),
    ).toBeInTheDocument();
  });
});
