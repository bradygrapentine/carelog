import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RecipientProfile } from "../RecipientProfile";

// next/image stub — render a plain <img> so jsdom can introspect alt/src.
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // strip non-DOM props
    const { fill: _fill, sizes: _sizes, ...rest } = props as {
      fill?: boolean;
      sizes?: string;
    } & Record<string, unknown>;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as Record<string, unknown>)} />;
  },
}));

const baseProps = {
  name: "Margaret Hoffman",
  age: 82,
  mood: "good" as const,
  conditions: ["Alzheimer's disease", "Hypothyroidism", "Hypertension"],
  caregivers: [
    { id: "u1", name: "Anna Hoffman", role: "Daughter · primary" },
    { id: "u2", name: "Sarah Reed", role: "Sister · overnights" },
  ],
  about:
    "Maggie taught third grade in Boulder for 32 years. Loves the cabin in Estes Park and her cat Pickles.",
  avatarUrl: "/avatars/maggie.png",
};

describe("RecipientProfile", () => {
  it("renders all fields when fully populated", () => {
    render(<RecipientProfile {...baseProps} />);

    expect(screen.getByText("Margaret Hoffman")).toBeInTheDocument();
    expect(screen.getByTestId("recipient-profile-age")).toHaveTextContent(
      "82 years old",
    );
    expect(screen.getByTestId("recipient-profile-mood")).toHaveTextContent(
      "Good",
    );
    expect(screen.getByText(/third grade in Boulder/i)).toBeInTheDocument();

    const conditions = screen.getByRole("list", { name: /conditions/i });
    expect(within(conditions).getAllByRole("listitem")).toHaveLength(3);
    expect(within(conditions).getByText("Hypothyroidism")).toBeInTheDocument();

    const caregivers = screen.getByRole("list", {
      name: /primary caregivers/i,
    });
    expect(within(caregivers).getAllByRole("listitem")).toHaveLength(2);
    expect(within(caregivers).getByText("Anna Hoffman")).toBeInTheDocument();
    expect(
      within(caregivers).getByText(/Daughter · primary/),
    ).toBeInTheDocument();
  });

  it("omits avatar image and falls back to initials when no avatarUrl", () => {
    render(<RecipientProfile {...baseProps} avatarUrl={undefined} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTestId("recipient-profile-initials")).toHaveTextContent(
      "MH",
    );
  });

  it("renders avatar with descriptive alt text when avatarUrl provided", () => {
    render(<RecipientProfile {...baseProps} />);
    const img = screen.getByRole("img", { name: /margaret hoffman avatar/i });
    expect(img).toHaveAttribute("src", "/avatars/maggie.png");
  });

  it("omits the conditions section when conditions is empty or undefined", () => {
    const { rerender } = render(
      <RecipientProfile {...baseProps} conditions={[]} />,
    );
    expect(
      screen.queryByRole("list", { name: /conditions/i }),
    ).not.toBeInTheDocument();

    rerender(<RecipientProfile {...baseProps} conditions={undefined} />);
    expect(
      screen.queryByRole("list", { name: /conditions/i }),
    ).not.toBeInTheDocument();
  });

  it("omits the caregivers section when caregivers is empty or undefined", () => {
    render(<RecipientProfile {...baseProps} caregivers={undefined} />);
    expect(
      screen.queryByRole("list", { name: /primary caregivers/i }),
    ).not.toBeInTheDocument();
  });

  it("omits the About paragraph when about prop is missing", () => {
    render(<RecipientProfile {...baseProps} about={undefined} />);
    expect(screen.queryByText(/third grade in Boulder/i)).not.toBeInTheDocument();
  });

  it("omits the mood badge when mood is undefined", () => {
    render(<RecipientProfile {...baseProps} mood={undefined} />);
    expect(
      screen.queryByTestId("recipient-profile-mood"),
    ).not.toBeInTheDocument();
  });

  it("omits the age line when age is undefined", () => {
    render(<RecipientProfile {...baseProps} age={undefined} />);
    expect(
      screen.queryByTestId("recipient-profile-age"),
    ).not.toBeInTheDocument();
  });

  it("applies the correct mood-token class for crisis vs good", () => {
    const { rerender } = render(
      <RecipientProfile {...baseProps} mood="crisis" />,
    );
    const crisisBadge = screen.getByTestId("recipient-profile-mood");
    expect(crisisBadge.className).toMatch(/--color-mood-crisis/);

    rerender(<RecipientProfile {...baseProps} mood="good" />);
    const goodBadge = screen.getByTestId("recipient-profile-mood");
    expect(goodBadge.className).toMatch(/--color-mood-good/);
  });

  it("uses a labelled region with the recipient name as accessible name", () => {
    render(<RecipientProfile {...baseProps} />);
    // CardTitle id wired via aria-labelledby on the Card root.
    const card = screen.getByTestId("recipient-profile");
    expect(card).toHaveAttribute(
      "aria-labelledby",
      "recipient-profile-name",
    );
    expect(screen.getByText("Margaret Hoffman").id).toBe(
      "recipient-profile-name",
    );
  });

  it("renders responsively without horizontal overflow on the avatar (uses sm: utilities)", () => {
    // Regression guard: avatar must use responsive sizing classes so the card
    // collapses cleanly on small viewports. We assert on class presence rather
    // than computed layout (jsdom doesn't lay out).
    const { container } = render(<RecipientProfile {...baseProps} />);
    const avatar = container.querySelector(
      "[data-testid='recipient-profile'] .rounded-2xl",
    );
    expect(avatar).not.toBeNull();
    expect(avatar?.className).toMatch(/h-16/);
    expect(avatar?.className).toMatch(/sm:h-20/);
  });
});
