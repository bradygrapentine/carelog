import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OnboardingForm } from "../OnboardingForm";

const { mockGetUser, mockAuthenticatedFetch } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockAuthenticatedFetch: vi.fn(),
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
      expect(window.location.href).toBe("/dashboard");
    });
  });

  it("shows error message on API error response", async () => {
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
      expect(
        screen.getByText("Something went wrong creating the org"),
      ).toBeInTheDocument();
    });
  });
});
