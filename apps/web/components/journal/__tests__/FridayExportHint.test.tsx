import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FridayExportHint } from "../FridayExportHint";

describe("FridayExportHint", () => {
  it("renders the eyebrow text", () => {
    render(<FridayExportHint />);
    expect(screen.getByText(/friday · therapist export/i)).toBeInTheDocument();
  });

  it("renders the body copy mentioning Friday email", () => {
    render(<FridayExportHint />);
    expect(screen.getByText(/friday email/i)).toBeInTheDocument();
  });

  it("includes the therapistEmail in the body when provided", () => {
    render(<FridayExportHint therapistEmail="dr.lee@example.com" />);
    expect(screen.getByText(/dr\.lee@example\.com/i)).toBeInTheDocument();
  });

  it("omits the email phrase when therapistEmail is not provided", () => {
    render(<FridayExportHint />);
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
});
