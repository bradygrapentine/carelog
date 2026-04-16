import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "vitest-axe";
import { expect, it, describe } from "vitest";
import { Card, CardHeader, CardTitle, CardContent } from "../card";

expect.extend(toHaveNoViolations);

describe("<Card /> accessibility", () => {
  it("has no axe violations", async () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Test Card Title</CardTitle>
        </CardHeader>
        <CardContent>Card body content</CardContent>
      </Card>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
