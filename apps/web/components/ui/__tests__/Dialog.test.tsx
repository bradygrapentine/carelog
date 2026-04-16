import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "vitest-axe";
import { expect, it, describe } from "vitest";

expect.extend(toHaveNoViolations);

describe("<Dialog /> accessibility", () => {
  it.skip("in open state has no axe violations", async () => {
    // TODO: Dialog component does not yet exist in apps/web/components/ui/
    // When Dialog is added, implement this test:
    // const { container } = render(
    //   <Dialog open>
    //     <DialogContent>
    //       <DialogHeader>
    //         <DialogTitle>Test dialog</DialogTitle>
    //       </DialogHeader>
    //       <p>Dialog body content</p>
    //     </DialogContent>
    //   </Dialog>
    // );
    // const results = await axe(container);
    // expect(results).toHaveNoViolations();
  });
});
