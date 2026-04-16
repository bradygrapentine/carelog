import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/matchers";
import { expect, it, describe } from "vitest";
import { Input } from "../input";

expect.extend({ toHaveNoViolations });

describe("<Input /> accessibility", () => {
  it("with associated label has no axe violations", async () => {
    const { container } = render(
      <>
        <label htmlFor="test-input">Name</label>
        <Input id="test-input" placeholder="Enter name" />
      </>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
