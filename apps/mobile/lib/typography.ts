import { PixelRatio } from "react-native";

const MAX_FONT_SCALE = 1.5;

/**
 * Scale a base font size by the device accessibility font scale,
 * capped at 1.5× to prevent layout overflow.
 *
 * Usage:
 *   fontSize: scaledFont(14)
 *   fontSize: scaledFont(typography.bodySize)
 */
export function scaledFont(baseSize: number): number {
  const scale = Math.min(PixelRatio.getFontScale(), MAX_FONT_SCALE);
  return Math.round(baseSize * scale);
}
