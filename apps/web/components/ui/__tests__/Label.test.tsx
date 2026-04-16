import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/matchers";
import { expect, it, describe } from "vitest";

expect.extend({ toHaveNoViolations });

describe("<Label /> accessibility", () => {
  it.skip("with htmlFor association has no axe violations", async () => {
    // TODO: Label component does not yet exist in apps/web/components/ui/
    // When Label is added, implement this test:
    // const { container } = render(
    //   <>
    //     <Label htmlFor="name-field">Full name</Label>
    //     <input id="name-field" type="text" />
    //   </>
    // );
    // const results = await axe(container);
    // expect(results).toHaveNoViolations();
  });
});
