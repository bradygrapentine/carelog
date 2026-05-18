import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { EmergencyFooterCard } from "../EmergencyFooterCard";

const { mockMutate, mockHook, mockRefresh } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
  mockHook: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    recipients: {
      updateEmergencyInfo: { useMutation: mockHook },
    },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

beforeEach(() => {
  mockMutate.mockReset();
  mockHook.mockReset();
  mockRefresh.mockReset();
  mockHook.mockReturnValue({ mutate: mockMutate, isPending: false });
});

const ORG_ID = "10000000-0000-0000-0000-000000000001";
const REC_ID = "20000000-0000-0000-0000-000000000001";

describe("EmergencyFooterCard (read-only behavior — unchanged)", () => {
  it("renders the Emergency eyebrow", () => {
    render(<EmergencyFooterCard dnrStatus="Full code" />);
    expect(screen.getByText(/^Emergency$/i)).toBeInTheDocument();
  });

  it("renders the DNR / code status when provided", () => {
    render(<EmergencyFooterCard dnrStatus="DNR — full code declined" />);
    expect(screen.getByText(/dnr — full code declined/i)).toBeInTheDocument();
  });

  it("renders the primary contact name", () => {
    render(
      <EmergencyFooterCard
        primaryContact={{ name: "Sarah H.", relationship: "Daughter" }}
      />,
    );
    expect(screen.getByText("Sarah H.")).toBeInTheDocument();
    expect(screen.getByText(/daughter/i)).toBeInTheDocument();
  });

  it("renders contact phone as a tel: link with descriptive aria-label", () => {
    render(
      <EmergencyFooterCard
        primaryContact={{
          name: "Sarah H.",
          phone: "+15555550123",
        }}
      />,
    );
    const link = screen.getByRole("link", { name: /call sarah h\./i });
    expect(link).toHaveAttribute("href", "tel:+15555550123");
  });

  it("does not render a tel: link when phone is omitted", () => {
    render(<EmergencyFooterCard primaryContact={{ name: "Sarah H." }} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders the hospital preference when provided", () => {
    render(<EmergencyFooterCard hospital="Memorial Cooper" />);
    expect(screen.getByText(/memorial cooper/i)).toBeInTheDocument();
  });

  it("renders empty fallback when no fields are provided", () => {
    render(<EmergencyFooterCard />);
    expect(
      screen.getByText(/no emergency information recorded/i),
    ).toBeInTheDocument();
  });

  it("section has aria-label='Emergency information'", () => {
    render(<EmergencyFooterCard hospital="x" />);
    expect(
      screen.getByRole("region", { name: /emergency information/i }),
    ).toBeInTheDocument();
  });

  it("with editable=false, does NOT render an Edit button", () => {
    render(
      <EmergencyFooterCard
        hospital="Memorial"
        editable={false}
        recipientId={REC_ID}
        orgId={ORG_ID}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /edit emergency/i }),
    ).not.toBeInTheDocument();
  });
});

describe("EmergencyFooterCard — UX-105b edit affordance", () => {
  const editableProps = {
    dnrStatus: "Full code",
    primaryContact: {
      name: "Sarah H.",
      relationship: "Daughter",
      phone: "+15555550123",
    },
    hospital: "Memorial Cooper",
    editable: true,
    recipientId: REC_ID,
    orgId: ORG_ID,
  };

  it("renders an Edit button when editable=true with recipientId+orgId", () => {
    render(<EmergencyFooterCard {...editableProps} />);
    expect(
      screen.getByRole("button", { name: /edit emergency/i }),
    ).toBeInTheDocument();
  });

  it("does NOT render Edit button when editable=true but recipientId missing", () => {
    render(<EmergencyFooterCard {...editableProps} recipientId={undefined} />);
    expect(
      screen.queryByRole("button", { name: /edit emergency/i }),
    ).not.toBeInTheDocument();
  });

  it("clicking Edit reveals form with prefilled values", () => {
    render(<EmergencyFooterCard {...editableProps} />);
    fireEvent.click(screen.getByRole("button", { name: /edit emergency/i }));
    expect(
      (screen.getByLabelText(/code status/i) as HTMLInputElement).value,
    ).toBe("Full code");
    expect((screen.getByLabelText(/hospital/i) as HTMLInputElement).value).toBe(
      "Memorial Cooper",
    );
    expect(
      (screen.getByLabelText(/name \(leave blank/i) as HTMLInputElement).value,
    ).toBe("Sarah H.");
    expect((screen.getByLabelText(/phone/i) as HTMLInputElement).value).toBe(
      "+15555550123",
    );
  });

  it("submitting the form calls recipients.updateEmergencyInfo with full payload", () => {
    render(<EmergencyFooterCard {...editableProps} />);
    fireEvent.click(screen.getByRole("button", { name: /edit emergency/i }));
    fireEvent.change(screen.getByLabelText(/code status/i), {
      target: { value: "DNR" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith({
      org_id: ORG_ID,
      recipient_id: REC_ID,
      dnr_status: "DNR",
      hospital: "Memorial Cooper",
      primary_contact: {
        name: "Sarah H.",
        relationship: "Daughter",
        phone: "+15555550123",
      },
    });
  });

  it("invalid phone soft-blocks submit with inline alert", () => {
    render(<EmergencyFooterCard {...editableProps} />);
    fireEvent.click(screen.getByRole("button", { name: /edit emergency/i }));
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: "abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/phone like/i);
  });

  it("save button is disabled while mutation is pending", () => {
    mockHook.mockReturnValue({ mutate: mockMutate, isPending: true });
    render(<EmergencyFooterCard {...editableProps} />);
    fireEvent.click(screen.getByRole("button", { name: /edit emergency/i }));
    const save = screen.getByRole("button", { name: /saving…|save/i });
    expect(save).toBeDisabled();
  });

  it("Cancel restores form values and exits edit mode", () => {
    render(<EmergencyFooterCard {...editableProps} />);
    fireEvent.click(screen.getByRole("button", { name: /edit emergency/i }));
    fireEvent.change(screen.getByLabelText(/hospital/i), {
      target: { value: "Other" },
    });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    // Back in read mode — original hospital still shows
    expect(screen.getByText(/memorial cooper/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^save$/i }),
    ).not.toBeInTheDocument();
  });

  it("on success, refreshes the router and exits edit mode", () => {
    const callbacks: { onSuccess?: () => void } = {};
    mockHook.mockImplementation((opts: { onSuccess?: () => void }) => {
      callbacks.onSuccess = opts.onSuccess;
      return { mutate: mockMutate, isPending: false };
    });
    render(<EmergencyFooterCard {...editableProps} />);
    fireEvent.click(screen.getByRole("button", { name: /edit emergency/i }));
    act(() => {
      callbacks.onSuccess?.();
    });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: /^save$/i }),
    ).not.toBeInTheDocument();
  });

  it("on error, surfaces a generic 'Failed to update' alert", () => {
    const callbacks: { onError?: () => void } = {};
    mockHook.mockImplementation((opts: { onError?: () => void }) => {
      callbacks.onError = opts.onError;
      return { mutate: mockMutate, isPending: false };
    });
    render(<EmergencyFooterCard {...editableProps} />);
    fireEvent.click(screen.getByRole("button", { name: /edit emergency/i }));
    act(() => {
      callbacks.onError?.();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/failed to update/i);
  });
});
