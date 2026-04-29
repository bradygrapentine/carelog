import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BriefHeadline } from "../BriefHeadline";

describe("BriefHeadline", () => {
  it("renders the structured headline with em spans for emphasis words", () => {
    render(
      <h2 className="headline-display">
        <BriefHeadline
          headline={[
            { text: "Mom slept " },
            { text: "poorly", em: true },
            { text: ". Three doses " },
            { text: "missed", em: true },
            { text: "." },
          ]}
          fallback="Care brief"
        />
      </h2>,
    );

    const heading = screen.getByRole("heading", { level: 2 });
    // Emphasis words appear inside <em>; plain words do not.
    const emTags = heading.querySelectorAll("em");
    expect(emTags).toHaveLength(2);
    expect(emTags[0]?.textContent).toBe("poorly");
    expect(emTags[1]?.textContent).toBe("missed");
    // Full text concatenates to the readable sentence.
    expect(heading.textContent).toBe("Mom slept poorly. Three doses missed.");
  });

  it("falls back to the plain string when headline is null", () => {
    render(
      <h2 className="headline-display">
        <BriefHeadline headline={null} fallback="Care brief" />
      </h2>,
    );
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toBe("Care brief");
    expect(heading.querySelectorAll("em")).toHaveLength(0);
  });

  it("falls back to the plain string for invalid stored headline data", () => {
    render(
      <h2 className="headline-display">
        <BriefHeadline
          headline={"not an array" as unknown}
          fallback="Care brief"
        />
      </h2>,
    );
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Care brief",
    );
  });

  it("renders inside an h1 (share route) the same way", () => {
    render(
      <h1 className="headline-display">
        <BriefHeadline
          headline={[
            { text: "A " },
            { text: "steady", em: true },
            { text: " stretch." },
          ]}
          fallback="Care brief"
        />
      </h1>,
    );
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.querySelector("em")?.textContent).toBe("steady");
  });
});
