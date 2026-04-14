import { render } from "@testing-library/react-native";
import { Animated, View } from "react-native";
import { Skeleton, SkeletonRow } from "../Skeleton";

jest.mock("../../hooks/useAppTheme", () => ({
  useAppTheme: jest.fn(() => ({
    colors: { surfaceSubtle: "#f0e9ff" },
  })),
}));

// Prevent the animation loop from running during tests
jest.spyOn(Animated, "loop").mockImplementation(
  () => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() } as never),
);
jest.spyOn(Animated, "sequence").mockImplementation(() => ({} as never));

describe("Skeleton", () => {
  it("renders without crashing with no props", () => {
    expect(() => render(<Skeleton />)).not.toThrow();
  });

  it("accepts custom width, height, and borderRadius", () => {
    expect(() =>
      render(<Skeleton width={200} height={24} borderRadius={8} />),
    ).not.toThrow();
  });

  it("matches snapshot with default props", () => {
    const { toJSON } = render(<Skeleton />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("matches snapshot with custom props", () => {
    const { toJSON } = render(
      <Skeleton width={200} height={24} borderRadius={8} />,
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("starts animation loop on mount", () => {
    render(<Skeleton />);
    expect(Animated.loop).toHaveBeenCalled();
  });
});

describe("SkeletonRow", () => {
  it("renders without crashing", () => {
    expect(() => render(<SkeletonRow />)).not.toThrow();
  });

  it("renders exactly 3 child Skeleton (Animated.View) elements", () => {
    const { UNSAFE_getAllByType } = render(<SkeletonRow />);
    // Each Skeleton renders one Animated.View; SkeletonRow has 3 Skeletons
    const animatedViews = UNSAFE_getAllByType(Animated.View);
    expect(animatedViews).toHaveLength(3);
  });

  it("matches snapshot", () => {
    const { toJSON } = render(<SkeletonRow />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders in dark mode without crashing", () => {
    const { useAppTheme } = require("../../hooks/useAppTheme");
    useAppTheme.mockReturnValueOnce({
      colors: { surfaceSubtle: "#2a1a4e" },
    });
    expect(() => render(<SkeletonRow />)).not.toThrow();
  });
});
