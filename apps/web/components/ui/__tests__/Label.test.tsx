import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/matchers";
import { expect, it, describe } from "vitest";
import { Label } from "@/components/ui/label";

// @ts-expect-error TD-16: vitest-axe/matchers uses 'export type *'; runtime JS exports the value fine
expect.extend({ toHaveNoViolations });

describe("<Label /> accessibility", () => {
  it("with htmlFor association has no axe violations", async () => {
    const { container } = render(
      <>
        <Label htmlFor="name-field">Full name</Label>
        <input id="name-field" type="text" />
      </>
    );
    const results = await axe(container);
    // @ts-expect-error TD-16: vitest-axe augments Vi namespace (vitest<3.x); vitest 4.x uses @vitest/expect
    expect(results).toHaveNoViolations();
  });
});
