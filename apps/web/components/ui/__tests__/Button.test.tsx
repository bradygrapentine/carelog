import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/matchers";
import { expect, it, describe } from "vitest";
import { Button } from "../button";

// @ts-expect-error TD-16: vitest-axe/matchers uses 'export type *'; runtime JS exports the value fine
expect.extend({ toHaveNoViolations });

describe("<Button /> accessibility", () => {
  it("default button has no axe violations", async () => {
    const { container } = render(<Button>Click me</Button>);
    const results = await axe(container);
    // @ts-expect-error TD-16: vitest-axe augments Vi namespace (vitest<3.x); vitest 4.x uses @vitest/expect
    expect(results).toHaveNoViolations();
  });

  it("outline variant has no axe violations", async () => {
    const { container } = render(<Button variant="outline">Outline</Button>);
    const results = await axe(container);
    // @ts-expect-error TD-16: vitest-axe augments Vi namespace (vitest<3.x); vitest 4.x uses @vitest/expect
    expect(results).toHaveNoViolations();
  });

  it("disabled button has no axe violations", async () => {
    const { container } = render(<Button disabled>Disabled</Button>);
    const results = await axe(container);
    // @ts-expect-error TD-16: vitest-axe augments Vi namespace (vitest<3.x); vitest 4.x uses @vitest/expect
    expect(results).toHaveNoViolations();
  });

  it("icon-only button with aria-label has no axe violations", async () => {
    const { container } = render(
      <Button aria-label="Close" size="icon">
        <span aria-hidden="true">✕</span>
      </Button>,
    );
    const results = await axe(container);
    // @ts-expect-error TD-16: vitest-axe augments Vi namespace (vitest<3.x); vitest 4.x uses @vitest/expect
    expect(results).toHaveNoViolations();
  });
});
