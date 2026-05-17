import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SignInForm } from "../SignInForm";

const { mockSignInWithOtp, mockVerifyOtp, mockReplace } = vi.hoisted(() => ({
  mockSignInWithOtp: vi.fn(),
  mockVerifyOtp: vi.fn(),
  mockReplace: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    auth: {
      signInWithOtp: mockSignInWithOtp,
      verifyOtp: mockVerifyOtp,
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SignInForm", () => {
  it("renders email input and Continue with email button", () => {
    render(<SignInForm />);
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue with email" }),
    ).toBeInTheDocument();
  });

  it("shows OTP step after submitting email", async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });

    render(<SignInForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Enter your code")).toBeInTheDocument();
  });

  it("calls router.replace with /dashboard on valid OTP", async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    render(<SignInForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );

    await waitFor(() => screen.getByLabelText("Enter your code"));

    fireEvent.change(screen.getByLabelText("Enter your code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows error message on wrong OTP", async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });
    mockVerifyOtp.mockResolvedValue({
      data: {},
      error: { message: "Token has expired or is invalid" },
    });

    render(<SignInForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );

    await waitFor(() => screen.getByLabelText("Enter your code"));

    fireEvent.change(screen.getByLabelText("Enter your code"), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "That code didn't work. Check the digits or send a new code.",
        ),
      ).toBeInTheDocument();
    });
    // TD-154: the old "expired" wording pushed users to discard a valid code
    expect(screen.queryByText(/The code expired/i)).not.toBeInTheDocument();
    // The raw Supabase error string must NOT leak to the UI.
    expect(
      screen.queryByText("Token has expired or is invalid"),
    ).not.toBeInTheDocument();
  });

  it("shows the same code-didn't-work copy for a genuinely-expired OTP (TD-154)", async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });
    mockVerifyOtp.mockResolvedValue({
      data: {},
      error: { message: "OTP has expired" },
    });

    render(<SignInForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );

    await waitFor(() => screen.getByLabelText("Enter your code"));

    fireEvent.change(screen.getByLabelText("Enter your code"), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "That code didn't work. Check the digits or send a new code.",
        ),
      ).toBeInTheDocument();
    });
    // Same copy as the wrong-code path: no wrong-vs-expired oracle
    expect(screen.queryByText(/The code expired/i)).not.toBeInTheDocument();
  });

  it("button is disabled while submitting email", async () => {
    let resolve: (v: unknown) => void;
    mockSignInWithOtp.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );

    render(<SignInForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );

    expect(screen.getByText("Sending...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();

    resolve!({ error: null });
    await waitFor(() => screen.getByText("Check your email"));
  });

  it("shows error when supabase returns error on email submit", async () => {
    mockSignInWithOtp.mockResolvedValue({
      error: { message: "Email rate limit exceeded" },
    });

    render(<SignInForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "bad@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("Too many attempts. Wait a minute and try again."),
      ).toBeInTheDocument();
    });
    // The raw Supabase error string must NOT leak to the UI.
    expect(
      screen.queryByText("Email rate limit exceeded"),
    ).not.toBeInTheDocument();
    // Should stay on email step
    expect(screen.queryByText("Check your email")).not.toBeInTheDocument();
  });

  it("resets loading state after successful OTP verify (no stuck spinner)", async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    // router.replace as no-op: simulates delayed/stuck navigation
    mockReplace.mockImplementation(() => {});

    render(<SignInForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );
    await waitFor(() => screen.getByLabelText("Enter your code"));

    fireEvent.change(screen.getByLabelText("Enter your code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));

    await waitFor(() => expect(mockVerifyOtp).toHaveBeenCalled());
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Verifying..." }),
      ).not.toBeInTheDocument();
    });
  });
});
