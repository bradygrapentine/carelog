import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OnboardingForm } from "../OnboardingForm";

const { mockGetUser, mockAuthenticatedFetch, mockReplace } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockAuthenticatedFetch: vi.fn(),
  mockReplace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

vi.mock("@/lib/authenticatedFetch", () => ({
  authenticatedFetch: mockAuthenticatedFetch,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-abc" } } });
  vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
});

describe("OnboardingForm", () => {
  it("renders recipient name and org name fields", () => {
    render(<OnboardingForm />);
    expect(
      screen.getByPlaceholderText("e.g. Margaret Smith"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("e.g. The Smith Family"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create care team" }),
    ).toBeInTheDocument();
  });

  it("calls authenticatedFetch with correct body on submit", async () => {
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ orgId: "org-123" }),
    });

    render(<OnboardingForm />);
    fireEvent.change(screen.getByPlaceholderText("e.g. Margaret Smith"), {
      target: { value: "Margaret Smith" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. The Smith Family"), {
      target: { value: "The Smith Family" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create care team" }));

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/onboarding/create",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            recipientName: "Margaret Smith",
            recipientDob: null,
            orgName: "The Smith Family",
          }),
        }),
      );
    });
  });

  it("redirects to /dashboard on success", async () => {
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ orgId: "org-123" }),
    });

    render(<OnboardingForm />);
    fireEvent.change(screen.getByPlaceholderText("e.g. Margaret Smith"), {
      target: { value: "Alice" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. The Smith Family"), {
      target: { value: "Alice Family" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create care team" }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows a generic error message on API error response (does not leak server detail)", async () => {
    mockAuthenticatedFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Something went wrong creating the org" }),
    });

    render(<OnboardingForm />);
    fireEvent.change(screen.getByPlaceholderText("e.g. Margaret Smith"), {
      target: { value: "Bob" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. The Smith Family"), {
      target: { value: "Bob Family" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create care team" }));

    await waitFor(() => {
      expect(screen.getByText(/that didn't save/i)).toBeInTheDocument();
    });
    // The raw server error string must NOT leak to the user.
    expect(
      screen.queryByText("Something went wrong creating the org"),
    ).not.toBeInTheDocument();
  });
});
