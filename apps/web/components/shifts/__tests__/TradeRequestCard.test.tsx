import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TradeRequestCard } from "../TradeRequestCard";

const BASE_TRADE = {
  id: "trade-001",
  shift_id: "shift-001",
  org_id: "org-001",
  requested_by: "user-aaa-111",
  target_user_id: null as string | null,
  status: "open" as const,
  message: null as string | null,
  resolved_by: null as string | null,
  resolved_at: null as string | null,
  created_at: "2026-04-15T10:00:00Z",
  expires_at: "2026-04-22T10:00:00Z",
};

const CURRENT_USER = "user-bbb-222";
const REQUESTER_ID = "user-aaa-111";

describe("TradeRequestCard", () => {
  it("renders status badge for open trade", () => {
    render(
      <TradeRequestCard
        trade={BASE_TRADE}
        currentUserId={CURRENT_USER}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/status: open/i)).toBeInTheDocument();
  });

  it("shows Accept and Decline buttons when current user is the target", () => {
    const trade = {
      ...BASE_TRADE,
      target_user_id: CURRENT_USER,
      requested_by: REQUESTER_ID,
    };
    render(
      <TradeRequestCard
        trade={trade}
        currentUserId={CURRENT_USER}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /decline/i }),
    ).toBeInTheDocument();
  });

  it("shows Accept and Decline buttons when trade is open (no specific target)", () => {
    render(
      <TradeRequestCard
        trade={BASE_TRADE}
        currentUserId={CURRENT_USER}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /decline/i }),
    ).toBeInTheDocument();
  });

  it("shows Cancel button when current user is the requester", () => {
    const trade = { ...BASE_TRADE, requested_by: CURRENT_USER };
    render(
      <TradeRequestCard
        trade={trade}
        currentUserId={CURRENT_USER}
        onRespond={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /cancel request/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /accept/i }),
    ).not.toBeInTheDocument();
  });

  it("hides action buttons when status is accepted", () => {
    const trade = { ...BASE_TRADE, status: "accepted" as const };
    render(
      <TradeRequestCard
        trade={trade}
        currentUserId={CURRENT_USER}
        onRespond={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /accept/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /decline/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /cancel/i }),
    ).not.toBeInTheDocument();
  });

  it("shows force-override section when isCoordinator=true and status=open", () => {
    render(
      <TradeRequestCard
        trade={BASE_TRADE}
        currentUserId={CURRENT_USER}
        isCoordinator={true}
        onRespond={vi.fn()}
        onForceOverride={vi.fn()}
      />,
    );
    expect(screen.getByText(/coordinator override/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /force accept/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /force decline/i }),
    ).toBeInTheDocument();
  });

  it("calls onRespond with correct args when Accept is clicked", () => {
    const onRespond = vi.fn();
    const trade = {
      ...BASE_TRADE,
      target_user_id: CURRENT_USER,
      requested_by: REQUESTER_ID,
    };
    render(
      <TradeRequestCard
        trade={trade}
        currentUserId={CURRENT_USER}
        onRespond={onRespond}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /accept/i }));
    expect(onRespond).toHaveBeenCalledOnce();
    expect(onRespond).toHaveBeenCalledWith("trade-001", "accept");
  });
});
