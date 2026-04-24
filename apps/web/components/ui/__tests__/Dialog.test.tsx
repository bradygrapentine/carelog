import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/matchers";
import { expect, it, describe } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// @ts-expect-error TD-16: vitest-axe/matchers uses 'export type *'; runtime JS exports the value fine
expect.extend({ toHaveNoViolations });

describe("<Dialog /> accessibility", () => {
  it("in open state has no axe violations", async () => {
    const { container } = render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test dialog</DialogTitle>
          </DialogHeader>
          <p>Dialog body content</p>
        </DialogContent>
      </Dialog>
    );
    const results = await axe(container);
    // @ts-expect-error TD-16: vitest-axe augments Vi namespace (vitest<3.x); vitest 4.x uses @vitest/expect
    expect(results).toHaveNoViolations();
  });
});
