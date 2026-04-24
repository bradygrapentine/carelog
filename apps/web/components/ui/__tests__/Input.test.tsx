import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/matchers";
import { expect, it, describe } from "vitest";
import { Input } from "../input";

// @ts-expect-error TD-16: vitest-axe/matchers uses 'export type *'; runtime JS exports the value fine
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
    // @ts-expect-error TD-16: vitest-axe augments Vi namespace (vitest<3.x); vitest 4.x uses @vitest/expect
    expect(results).toHaveNoViolations();
  });
});
