import { PixelRatio } from "react-native";
import { scaledFont } from "../lib/font-scale";

describe("scaledFont", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("caps at 1.5x when PixelRatio.getFontScale returns 2.0", () => {
    jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(2.0);
    expect(scaledFont(14)).toBe(Math.round(14 * 1.5)); // = 21
  });

  it("passes through at 1.0x", () => {
    jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(1.0);
    expect(scaledFont(14)).toBe(14);
  });

  it("rounds correctly at 1.3x", () => {
    jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(1.3);
    expect(scaledFont(14)).toBe(Math.round(14 * 1.3)); // = 18
  });

  it("applies scale correctly to base sizes used in medications screen", () => {
    jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(1.2);
    expect(scaledFont(16)).toBe(Math.round(16 * 1.2)); // = 19
    expect(scaledFont(13)).toBe(Math.round(13 * 1.2)); // = 16
    expect(scaledFont(12)).toBe(Math.round(12 * 1.2)); // = 14
  });

  it("applies scale correctly to base sizes used in schedule screen", () => {
    jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(1.2);
    expect(scaledFont(15)).toBe(Math.round(15 * 1.2)); // = 18
    expect(scaledFont(14)).toBe(Math.round(14 * 1.2)); // = 17
  });
});
