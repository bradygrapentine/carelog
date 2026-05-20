import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SignInForm } from "../SignInForm";

const {
  mockSignInWithOtp,
  mockVerifyOtp,
  mockSignInWithPassword,
  mockReplace,
  mockIdentify,
  mockCapture,
} = vi.hoisted(() => ({
  mockSignInWithOtp: vi.fn(),
  mockVerifyOtp: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockReplace: vi.fn(),
  mockIdentify: vi.fn(),
  mockCapture: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    auth: {
      signInWithOtp: mockSignInWithOtp,
      verifyOtp: mockVerifyOtp,
      signInWithPassword: mockSignInWithPassword,
    },
  }),
}));

vi.mock("posthog-js", () => ({
  default: { identify: mockIdentify, capture: mockCapture },
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

  // ── TD-221: email+password coexisting method ────────────────────────────
  it("toggles to password mode and renders a password field", () => {
    render(<SignInForm />);
    fireEvent.click(
      screen.getByRole("button", { name: "Use a password instead" }),
    );
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    // OTP method is reachable again (not removed)
    expect(
      screen.getByRole("button", { name: "Use a code instead" }),
    ).toBeInTheDocument();
  });

  it("password sign-in: session/user drives identify + redirect", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: "user-pw-1" }, session: { access_token: "t" } },
      error: null,
    });

    render(<SignInForm />);
    fireEvent.click(
      screen.getByRole("button", { name: "Use a password instead" }),
    );
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-horse-battery" }, // ≥12 chars
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "correct-horse-battery",
      });
    });
    // The returned user (session) is what drives identify(uuid) + redirect —
    // proves we don't redirect on a sessionless response.
    expect(mockIdentify).toHaveBeenCalledWith("user-pw-1");
    // identify must be UUID only — never the email (PHI)
    expect(mockIdentify).not.toHaveBeenCalledWith("test@example.com");
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"));
  });

  it("password sign-in: wrong password and unknown user show IDENTICAL generic copy (no enumeration)", async () => {
    const GENERIC = "Email or password is incorrect.";

    // Wrong password
    mockSignInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { message: "Invalid login credentials" },
    });
    const { unmount } = render(<SignInForm />);
    fireEvent.click(
      screen.getByRole("button", { name: "Use a password instead" }),
    );
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "real@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-but-long-enough" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByText(GENERIC)).toBeInTheDocument());
    // raw GoTrue string must not leak
    expect(
      screen.queryByText("Invalid login credentials"),
    ).not.toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
    unmount();

    // Unknown user — must render the SAME copy (no "no such user" oracle)
    mockSignInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { message: "Invalid login credentials" },
    });
    render(<SignInForm />);
    fireEvent.click(
      screen.getByRole("button", { name: "Use a password instead" }),
    );
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "ghost@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "anything-long-enough" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByText(GENERIC)).toBeInTheDocument());
  });

  it("password sign-in: submit disabled until password ≥12 chars", () => {
    render(<SignInForm />);
    fireEvent.click(
      screen.getByRole("button", { name: "Use a password instead" }),
    );
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "short" },
    });
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "twelve-chars-ok" }, // ≥12
    });
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
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
