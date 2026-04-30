import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { LiveRegion, liveAnnounce } from "../LiveRegion";

describe("<LiveRegion />", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    cleanup();
  });

  it("renders an sr-only polite live region", () => {
    render(<LiveRegion />);
    const region = screen.getByTestId("live-region");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region).toHaveAttribute("role", "status");
    expect(region.className).toMatch(/sr-only/);
  });

  it("updates its content when liveAnnounce is called", () => {
    render(<LiveRegion />);
    expect(screen.getByTestId("live-region")).toHaveTextContent("");
    act(() => {
      liveAnnounce("Logged offline");
    });
    expect(screen.getByTestId("live-region")).toHaveTextContent(
      "Logged offline",
    );
  });

  it("clears the message after 5s so a repeat fires again", () => {
    render(<LiveRegion />);
    act(() => {
      liveAnnounce("Synced");
    });
    expect(screen.getByTestId("live-region")).toHaveTextContent("Synced");
    act(() => {
      vi.advanceTimersByTime(5001);
    });
    expect(screen.getByTestId("live-region")).toHaveTextContent("");
  });

  it("dispatches to multiple mounted regions", () => {
    render(
      <>
        <LiveRegion />
        <LiveRegion />
      </>,
    );
    act(() => {
      liveAnnounce("Hello");
    });
    const regions = screen.getAllByTestId("live-region");
    for (const r of regions) {
      expect(r).toHaveTextContent("Hello");
    }
  });

  it("survives liveAnnounce called before any region mounts", () => {
    expect(() => liveAnnounce("noop")).not.toThrow();
  });
});
