import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { Suspense } from "react";
import InvitePage from "../page";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const { mockGetUser, mockAuthenticatedFetch } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockAuthenticatedFetch: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

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
  vi.spyOn(global, "fetch").mockResolvedValue({
    json: async () => ({
      email: "invited@example.com",
      orgName: "Smith Family",
      role: "caregiver",
    }),
  } as Response);
}

function mockInvalidInvite() {
  vi.spyOn(global, "fetch").mockResolvedValue({
    json: async () => ({ error: "Invite not found or has expired." }),
  } as Response);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("InvitePage", () => {
  it("shows invite details when token is valid", async () => {
    mockValidInvite();
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

  it("calls POST accept when accept button is clicked", async () => {
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

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Accept invitation" }),
      );
    });

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/invite/" + TOKEN + "/accept",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("shows 'joined the team' after successful acceptance", async () => {
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

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Accept invitation" }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("You have joined the team")).toBeInTheDocument();
    });
  });

  it("shows error state for invalid or expired token", async () => {
    mockInvalidInvite();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Invite not found")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Invite not found or has expired."),
    ).toBeInTheDocument();
  });
});
