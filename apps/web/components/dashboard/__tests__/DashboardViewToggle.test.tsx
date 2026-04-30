import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  DashboardViewToggle,
  loadDashboardView,
  saveDashboardView,
} from "../DashboardViewToggle";

describe("DashboardViewToggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders single, stacked, and now options when showStacked is true", () => {
    render(<DashboardViewToggle view="single" onChange={() => {}} />);
    expect(
      screen.getByRole("button", { name: /single-recipient/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /show all recipients/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Now Board timeline/i }),
    ).toBeInTheDocument();
  });

  it("hides the stacked option when showStacked is false", () => {
    render(
      <DashboardViewToggle
        view="single"
        onChange={() => {}}
        showStacked={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /show all recipients/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Now Board timeline/i }),
    ).toBeInTheDocument();
  });

  it("marks the active option with aria-pressed=true", () => {
    render(<DashboardViewToggle view="now" onChange={() => {}} />);
    const nowBtn = screen.getByRole("button", { name: /Now Board timeline/i });
    expect(nowBtn).toHaveAttribute("aria-pressed", "true");
    const singleBtn = screen.getByRole("button", {
      name: /single-recipient/i,
    });
    expect(singleBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the picked value and persists to localStorage", () => {
    const onChange = vi.fn();
    render(<DashboardViewToggle view="single" onChange={onChange} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Now Board timeline/i }),
    );
    expect(onChange).toHaveBeenCalledWith("now");
    expect(localStorage.getItem("caresync.dashboardView")).toBe("now");
  });

  it("does not call onChange when the active option is clicked again", () => {
    const onChange = vi.fn();
    render(<DashboardViewToggle view="now" onChange={onChange} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Now Board timeline/i }),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("loadDashboardView reads stacked|now|single from localStorage", () => {
    expect(loadDashboardView()).toBe("single");
    saveDashboardView("now");
    expect(loadDashboardView()).toBe("now");
    saveDashboardView("stacked");
    expect(loadDashboardView()).toBe("stacked");
  });
});
