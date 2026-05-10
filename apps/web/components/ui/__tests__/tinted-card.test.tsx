import { render } from "@testing-library/react";
import { expect, it, describe } from "vitest";
import { CardContent } from "../card";
import { TintedCard, TintedCardHeader } from "../tinted-card";

/**
 * TD-92 — TintedCard widened with optional `tone` prop.
 *
 * Default rendering is the canonical signature panel pattern (light primary-subtle tint).
 * `tone="dark"` adds dark-mode overrides for surfaces that need to render on dark shells.
 */

describe("<TintedCardHeader />", () => {
  it("default tone renders the canonical light tint and border tokens", () => {
    const { container } = render(
      <TintedCard>
        <TintedCardHeader title="Section" />
        <CardContent>body</CardContent>
      </TintedCard>,
    );

    const header = container.querySelector(
      "[data-slot='card-header']",
    ) as HTMLElement;
    expect(header).not.toBeNull();
    expect(header.className).toContain("bg-[var(--color-primary-subtle)]");
    expect(header.className).toContain("border-[var(--color-border)]");
    // Default tone must NOT introduce dark-mode classes — preserves the 12+
    // existing consumers byte-for-byte.
    expect(header.className).not.toContain("dark:bg-gray-700");
    expect(header.className).not.toContain("dark:border-gray-600");
  });

  // UX-110: dark mode retired. tone="dark" is now a no-op alias of "default".
  it.skip("tone=\"dark\" layers dark-mode overrides on top of the default tokens", () => {
    const { container } = render(
      <TintedCard>
        <TintedCardHeader tone="dark" title="Trade Requests" />
        <CardContent>body</CardContent>
      </TintedCard>,
    );

    const header = container.querySelector(
      "[data-slot='card-header']",
    ) as HTMLElement;
    expect(header).not.toBeNull();
    // Light-mode tokens still present — dark variant is additive.
    expect(header.className).toContain("bg-[var(--color-primary-subtle)]");
    expect(header.className).toContain("border-[var(--color-border)]");
    // Dark-mode overrides applied.
    expect(header.className).toContain("dark:bg-gray-700");
    expect(header.className).toContain("dark:border-gray-600");
  });

  it("renders the action slot with the flex justify-between layout", () => {
    const { container, getByRole } = render(
      <TintedCard>
        <TintedCardHeader
          tone="dark"
          title="Trade Requests"
          action={<button type="button">+ Request Trade</button>}
        />
        <CardContent>body</CardContent>
      </TintedCard>,
    );

    const header = container.querySelector(
      "[data-slot='card-header']",
    ) as HTMLElement;
    expect(header.className).toContain("flex");
    expect(header.className).toContain("justify-between");
    expect(getByRole("button", { name: "+ Request Trade" })).toBeTruthy();
  });
});
