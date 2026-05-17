/**
 * TD-173 — Tab semantics regression test for ShiftsPanel.
 *
 * Asserts that every layout button in the tablist (including the
 * UX-065 "Briefing" tab) carries role="tab" and is keyboard-reachable.
 * Future refactors that drop role attributes will fail this test.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../../../../lib/trpc", () => {
  const stubQuery = () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: () => undefined,
  });
  const stubMutation = () => ({
    mutate: () => undefined,
    mutateAsync: async () => undefined,
  });
  return {
    trpc: {
      shifts: {
        list: { useQuery: stubQuery },
        getLatestHandoff: { useQuery: stubQuery },
        upsertHandoff: { useMutation: stubMutation },
      },
      shiftQuestions: {
        list: { useQuery: stubQuery },
        create: { useMutation: stubMutation },
        resolve: { useMutation: stubMutation },
      },
      careEvents: {
        timeline: { useQuery: stubQuery },
      },
      useUtils: () => ({
        shifts: {
          list: { invalidate: () => undefined },
          getLatestHandoff: { invalidate: () => undefined },
        },
        shiftQuestions: { list: { invalidate: () => undefined } },
      }),
    },
  };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ShiftsPanel } from "../ShiftsPanel";

const baseProps = {
  orgId: "org-1",
  recipientId: "rec-1",
  members: [],
  currentUserId: "user-1",
  currentUserRole: "coordinator",
};

describe("<ShiftsPanel /> tab semantics (TD-173)", () => {
  it("exposes role=tab on every layout button, including Briefing", () => {
    render(<ShiftsPanel {...baseProps} />);

    const tabs = screen.getAllByRole("tab");
    const labels = tabs.map((t) => t.textContent?.trim());

    expect(labels).toContain("Briefing");
    expect(labels).toContain("Handoff");
    expect(tabs.length).toBe(8);
  });

  it("tablist has accessible aria-label", () => {
    render(<ShiftsPanel {...baseProps} />);
    expect(
      screen.getByRole("tablist", { name: /shift schedule layout/i }),
    ).toBeInTheDocument();
  });

  it("Briefing tab is a real <button> (keyboard-reachable, not a div)", () => {
    render(<ShiftsPanel {...baseProps} />);
    const briefingTab = screen
      .getAllByRole("tab")
      .find((t) => t.textContent?.trim() === "Briefing");
    expect(briefingTab?.tagName).toBe("BUTTON");
    expect(briefingTab).toHaveAttribute("type", "button");
  });
});
