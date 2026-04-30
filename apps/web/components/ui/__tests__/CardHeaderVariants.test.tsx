import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card, CardContent, CardTitle } from "../card";
import {
  CardHeaderAccent,
  CardHeaderOutline,
  CardHeaderSerif,
  CardHeaderTinted,
} from "../CardHeaderVariants";

/**
 * UX-055 — CareSync 2.0 card-header variants.
 *
 * Four header variants share a common contract:
 *   - Each wraps shadcn <CardHeader>, preserving its data-slot="card-header".
 *   - Each applies a single `card-header-*` class so all visual styling lives
 *     in globals.css (additive — no inline color values).
 *   - Each forwards children, className, and arbitrary div props.
 */

describe("<CardHeaderTinted />", () => {
  it("wraps CardHeader and applies card-header-tinted", () => {
    const { container } = render(
      <Card>
        <CardHeaderTinted>
          <CardTitle>Today</CardTitle>
        </CardHeaderTinted>
        <CardContent>body</CardContent>
      </Card>,
    );
    const header = container.querySelector(
      "[data-slot='card-header']",
    ) as HTMLElement;
    expect(header).not.toBeNull();
    expect(header.className).toContain("card-header-tinted");
  });

  it("renders children", () => {
    const { getByText } = render(
      <Card>
        <CardHeaderTinted>
          <CardTitle>Today</CardTitle>
        </CardHeaderTinted>
      </Card>,
    );
    expect(getByText("Today")).toBeTruthy();
  });
});

describe("<CardHeaderOutline />", () => {
  it("applies card-header-outline class on the underlying CardHeader", () => {
    const { container } = render(
      <Card>
        <CardHeaderOutline>
          <CardTitle>Outline</CardTitle>
        </CardHeaderOutline>
      </Card>,
    );
    const header = container.querySelector(
      "[data-slot='card-header']",
    ) as HTMLElement;
    expect(header).not.toBeNull();
    expect(header.className).toContain("card-header-outline");
  });

  it("merges caller-provided className without dropping the variant class", () => {
    const { container } = render(
      <Card>
        <CardHeaderOutline className="custom-extra">
          <CardTitle>Outline</CardTitle>
        </CardHeaderOutline>
      </Card>,
    );
    const header = container.querySelector(
      "[data-slot='card-header']",
    ) as HTMLElement;
    expect(header.className).toContain("card-header-outline");
    expect(header.className).toContain("custom-extra");
  });
});

describe("<CardHeaderAccent />", () => {
  it("applies card-header-accent class", () => {
    const { container } = render(
      <Card>
        <CardHeaderAccent>
          <CardTitle>Accent</CardTitle>
        </CardHeaderAccent>
      </Card>,
    );
    const header = container.querySelector(
      "[data-slot='card-header']",
    ) as HTMLElement;
    expect(header).not.toBeNull();
    expect(header.className).toContain("card-header-accent");
  });

  it("forwards arbitrary div props (data-* attributes)", () => {
    const { container } = render(
      <Card>
        <CardHeaderAccent data-testid="accent-header">
          <CardTitle>Accent</CardTitle>
        </CardHeaderAccent>
      </Card>,
    );
    const header = container.querySelector(
      "[data-testid='accent-header']",
    ) as HTMLElement;
    expect(header).not.toBeNull();
    expect(header.getAttribute("data-slot")).toBe("card-header");
  });
});

describe("<CardHeaderSerif />", () => {
  it("applies card-header-serif and the headline-display class for Fraunces italics", () => {
    const { container } = render(
      <Card>
        <CardHeaderSerif>
          <CardTitle>
            Today, <em>quietly</em>
          </CardTitle>
        </CardHeaderSerif>
      </Card>,
    );
    const header = container.querySelector(
      "[data-slot='card-header']",
    ) as HTMLElement;
    expect(header).not.toBeNull();
    expect(header.className).toContain("card-header-serif");
    // Serif variant opts in to the editorial Fraunces treatment so that
    // any <em> inside renders as the load-bearing italic emphasis.
    expect(header.className).toContain("headline-display");
  });

  it("renders descendant <em> content untouched (markup forwarded)", () => {
    const { container } = render(
      <Card>
        <CardHeaderSerif>
          <CardTitle>
            <em>quietly</em>
          </CardTitle>
        </CardHeaderSerif>
      </Card>,
    );
    expect(container.querySelector("em")).not.toBeNull();
  });
});

describe("variant a11y semantics", () => {
  it("each variant renders exactly one card-header slot", () => {
    const variants = [
      CardHeaderTinted,
      CardHeaderOutline,
      CardHeaderAccent,
      CardHeaderSerif,
    ] as const;
    for (const Variant of variants) {
      const { container } = render(
        <Card>
          <Variant>
            <CardTitle>x</CardTitle>
          </Variant>
        </Card>,
      );
      const headers = container.querySelectorAll(
        "[data-slot='card-header']",
      );
      expect(headers.length).toBe(1);
    }
  });
});
