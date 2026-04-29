import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AIPanel } from "../AIPanel";
import { trpc } from "@/lib/trpc";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockMutate, mockToastError } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    ai: {
      query: {
        useMutation: vi.fn(),
      },
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: mockToastError },
}));

vi.mock("@/hooks/useAIContext", () => ({
  useAIContext: () => ({
    pageKey: "journal",
    suggestions: [],
    globalSuggestions: [],
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("../AIChatThread", () => ({
  AIChatThread: () => <div data-testid="chat-thread" />,
}));

const defaultProps = {
  orgId: "org-1",
  recipientId: "rec-1",
  onClose: vi.fn(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPanel(mutationOverrides: object = {}) {
  vi.mocked(trpc.ai.query.useMutation).mockReturnValue({
    mutate: mockMutate,
    isPending: false,
    isError: false,
    ...mutationOverrides,
  } as any);
  return render(<AIPanel {...defaultProps} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AIPanel — loading state", () => {
  it("disables the send button while isPending", () => {
    renderPanel({ isPending: true });
    const sendBtn = screen.getByRole("button", { name: /send message/i });
    expect(sendBtn).toBeDisabled();
  });

  it("shows a Loader2 spinner (aria-hidden) inside the send button while isPending", () => {
    renderPanel({ isPending: true });
    // The spinner svg should be present in the DOM
    const sendBtn = screen.getByRole("button", { name: /send message/i });
    const svg = sendBtn.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("does not disable the send button when input is populated and not pending", () => {
    renderPanel({ isPending: false });
    const input = screen.getByRole("textbox", { name: /ask the ai/i });
    fireEvent.change(input, { target: { value: "hello" } });
    const sendBtn = screen.getByRole("button", { name: /send message/i });
    expect(sendBtn).not.toBeDisabled();
  });
});

describe("AIPanel — error state", () => {
  it("calls toast.error when mutation onError fires", () => {
    let capturedOnError: ((err: unknown) => void) | undefined;

    vi.mocked(trpc.ai.query.useMutation).mockImplementation((opts?: any) => {
      capturedOnError = opts?.onError;
      return {
        mutate: mockMutate,
        isPending: false,
        isError: false,
      } as any;
    });

    render(<AIPanel {...defaultProps} />);

    // Trigger the onError callback
    capturedOnError?.(new Error("network failure"));

    expect(mockToastError).toHaveBeenCalledWith(
      "The assistant didn't reply. Try again, or check back in a minute.",
    );
  });
});
