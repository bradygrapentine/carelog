import { PixelRatio } from "react-native";

// Cap at 1.5× so 200% Dynamic Type doesn't break dense list layouts.
// Users above this threshold see proportional but capped text.
export function scaledFont(base: number, cap = 1.5): number {
  return base * Math.min(PixelRatio.getFontScale(), cap);
}
