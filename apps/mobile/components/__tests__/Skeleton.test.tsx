import { render, act } from "@testing-library/react-native";
import { AccessibilityInfo, Animated, View } from "react-native";
import { Skeleton, SkeletonRow } from "../Skeleton";

jest.mock("../../hooks/useAppTheme", () => ({
  useAppTheme: jest.fn(() => ({
    colors: { surfaceSubtle: "#f0e9ff" },
  })),
}));

// Mock AccessibilityInfo by spying on the actual module
jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
jest
  .spyOn(AccessibilityInfo, "addEventListener" as any)
  .mockReturnValue({ remove: jest.fn() } as any);

// Prevent the animation loop from running during tests
jest.spyOn(Animated, "loop").mockImplementation(
  () => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() } as never),
);
jest.spyOn(Animated, "sequence").mockImplementation(() => ({} as never));

describe("Skeleton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(
      false,
    );
    (AccessibilityInfo.addEventListener as jest.Mock).mockReturnValue({
      remove: jest.fn(),
    });
  });

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

  it("does NOT start animation loop when reduced motion is enabled", async () => {
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValueOnce(
      true,
    );
    const { rerender } = render(<Skeleton />);
    // Let the async effect resolve
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    // Clear to check if animation is triggered by state change
    (Animated.loop as jest.Mock).mockClear();
    // Rerender to trigger effect with reducedMotion state updated to true
    await act(async () => {
      rerender(<Skeleton />);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    // Animated.loop should NOT be called when reducedMotion is true
    expect(Animated.loop).not.toHaveBeenCalled();
  });

  it("removes event listener on unmount", () => {
    const mockRemove = jest.fn();
    (AccessibilityInfo.addEventListener as jest.Mock).mockReturnValueOnce({
      remove: mockRemove,
    });
    const { unmount } = render(<Skeleton />);
    unmount();
    expect(mockRemove).toHaveBeenCalled();
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
