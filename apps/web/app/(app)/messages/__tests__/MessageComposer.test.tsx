// apps/web/app/(app)/messages/__tests__/MessageComposer.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MessageComposer } from "../MessageComposer";
import { trpc } from "@/lib/trpc";

const { mockMutate, mockInvalidate } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
  mockInvalidate: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      messages: { getMessages: { invalidate: mockInvalidate } },
    }),
    messages: {
      sendMessage: { useMutation: vi.fn() },
    },
  },
}));

function renderComposer(isPending = false) {
  vi.mocked(trpc.messages.sendMessage.useMutation).mockImplementation(
    () =>
      ({
        mutate: mockMutate,
        isPending,
      }) as unknown as ReturnType<typeof trpc.messages.sendMessage.useMutation>,
  );
  return render(<MessageComposer threadId="thread-uuid-1" />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MessageComposer", () => {
  it("renders a textarea and a send button", () => {
    renderComposer();
    expect(
      screen.getByRole("textbox", { name: /message body/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send message/i }),
    ).toBeInTheDocument();
  });

  it("send button is disabled when input is empty", () => {
    renderComposer();
    expect(
      screen.getByRole("button", { name: /send message/i }),
    ).toBeDisabled();
  });

  it("send button is enabled when input has non-whitespace text", () => {
    renderComposer();
    const textarea = screen.getByRole("textbox", { name: /message body/i });
    fireEvent.change(textarea, { target: { value: "hello world" } });
    expect(
      screen.getByRole("button", { name: /send message/i }),
    ).not.toBeDisabled();
  });

  it("send button is disabled when input is only whitespace", () => {
    renderComposer();
    const textarea = screen.getByRole("textbox", { name: /message body/i });
    fireEvent.change(textarea, { target: { value: "   " } });
    expect(
      screen.getByRole("button", { name: /send message/i }),
    ).toBeDisabled();
  });

  it("pressing Enter calls mutate with trimmed body", () => {
    renderComposer();
    const textarea = screen.getByRole("textbox", { name: /message body/i });
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(mockMutate).toHaveBeenCalledWith({
      threadId: "thread-uuid-1",
      body: "hello",
    });
  });

  it("Shift+Enter does NOT submit", () => {
    renderComposer();
    const textarea = screen.getByRole("textbox", { name: /message body/i });
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("clicking the send button calls mutate", () => {
    renderComposer();
    const textarea = screen.getByRole("textbox", { name: /message body/i });
    fireEvent.change(textarea, { target: { value: "test message" } });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    expect(mockMutate).toHaveBeenCalledWith({
      threadId: "thread-uuid-1",
      body: "test message",
    });
  });

  it("send button is disabled when mutation is pending", () => {
    renderComposer(true);
    const textarea = screen.getByRole("textbox", { name: /message body/i });
    fireEvent.change(textarea, { target: { value: "hello" } });
    expect(
      screen.getByRole("button", { name: /send message/i }),
    ).toBeDisabled();
  });

  it("clears input after successful send via onSuccess callback", () => {
    let capturedOnSuccess: (() => void) | undefined;
    vi.mocked(trpc.messages.sendMessage.useMutation).mockImplementation(
      ((opts?: { onSuccess?: () => void }) => {
        capturedOnSuccess = opts?.onSuccess;
        return {
          mutate: mockMutate,
          isPending: false,
        } as unknown as ReturnType<
          typeof trpc.messages.sendMessage.useMutation
        >;
      }) as unknown as typeof trpc.messages.sendMessage.useMutation,
    );

    render(<MessageComposer threadId="thread-uuid-1" />);
    const textarea = screen.getByRole("textbox", { name: /message body/i });
    fireEvent.change(textarea, { target: { value: "hello" } });
    expect(textarea).toHaveValue("hello");

    // Simulate successful mutation — wrap in act so React flushes state updates
    act(() => {
      capturedOnSuccess?.();
    });
    expect(textarea).toHaveValue("");
  });

  it("form submit event calls mutate", () => {
    renderComposer();
    const textarea = screen.getByRole("textbox", { name: /message body/i });
    fireEvent.change(textarea, { target: { value: "via form submit" } });
    const form = textarea.closest("form")!;
    fireEvent.submit(form);
    expect(mockMutate).toHaveBeenCalledWith({
      threadId: "thread-uuid-1",
      body: "via form submit",
    });
  });
});
