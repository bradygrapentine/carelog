import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "vitest-axe";
import { expect, it, describe } from "vitest";
import { Button } from "../button";

expect.extend(toHaveNoViolations);

describe("<Button /> accessibility", () => {
  it("default button has no axe violations", async () => {
    const { container } = render(<Button>Click me</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("outline variant has no axe violations", async () => {
    const { container } = render(<Button variant="outline">Outline</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("disabled button has no axe violations", async () => {
    const { container } = render(<Button disabled>Disabled</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("icon-only button with aria-label has no axe violations", async () => {
    const { container } = render(
      <Button aria-label="Close" size="icon">
        <span aria-hidden="true">✕</span>
      </Button>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
