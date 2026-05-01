import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { SageRail } from "../SageRail";

const defaultProps = {
  active: "brief",
  onNavigate: vi.fn(),
  recipient: { name: "Margaret H.", age: 82, relationship: "Mom" },
};

describe("SageRail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the brand mark 'CareSync'", () => {
    render(<SageRail {...defaultProps} />);
    expect(screen.getByText("CareSync")).toBeInTheDocument();
  });

  it("renders both section headers 'Today' and 'Record'", () => {
    render(<SageRail {...defaultProps} />);
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Record")).toBeInTheDocument();
  });

  it("renders all 8 nav items with correct labels", () => {
    render(<SageRail {...defaultProps} />);
    expect(screen.getByRole("button", { name: /daily brief/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /timeline/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /medications/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /shifts/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /journal/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mom's profile/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /documents/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /visit summaries/i })).toBeInTheDocument();
  });

  it("clicking a nav item calls onNavigate with the right id", () => {
    const onNavigate = vi.fn();
    render(<SageRail {...defaultProps} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: /timeline/i }));
    expect(onNavigate).toHaveBeenCalledWith("today");
    fireEvent.click(screen.getByRole("button", { name: /journal/i }));
    expect(onNavigate).toHaveBeenCalledWith("journal");
  });

  it("marks the active item with aria-current='page'", () => {
    render(<SageRail {...defaultProps} active="brief" />);
    const briefBtn = screen.getByRole("button", { name: /daily brief/i });
    expect(briefBtn).toHaveAttribute("aria-current", "page");
    const timelineBtn = screen.getByRole("button", { name: /timeline/i });
    expect(timelineBtn).not.toHaveAttribute("aria-current", "page");
  });

  it("renders the recipient footer with name, age, and relationship", () => {
    render(<SageRail {...defaultProps} />);
    expect(screen.getByText("Margaret H.")).toBeInTheDocument();
    expect(screen.getByText(/82/)).toBeInTheDocument();
    expect(screen.getByText(/Mom/)).toBeInTheDocument();
  });

  it("shows a count badge on daily-brief when attentionCount > 0", () => {
    render(<SageRail {...defaultProps} attentionCount={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("does not show a count badge when attentionCount is 0", () => {
    render(<SageRail {...defaultProps} attentionCount={0} />);
    // Badge should not render for 0
    const briefBtn = screen.getByRole("button", { name: /daily brief/i });
    expect(briefBtn).toBeInTheDocument();
    // "0" should not appear as a badge
    expect(screen.queryByText("0")).toBeNull();
  });
});
