import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/matchers";
import { expect, it, describe, vi } from "vitest";
import { QuickLogFab } from "@/components/QuickLogFab";

expect.extend({ toHaveNoViolations });

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/journal/recipient-123",
}));

describe("<QuickLogFab /> accessibility (axe)", () => {
  it("has no axe violations when closed", async () => {
    const { container } = render(<QuickLogFab />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no axe violations when open", async () => {
    const { container } = render(<QuickLogFab />);
    fireEvent.click(screen.getByRole("button", { name: "Quick log" }));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
