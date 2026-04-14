// useAppTheme — one-stop hook for consuming the active design tokens.
//
// Usage:
//   const { colors, spacing, radii, typography, shadows, fontFamily, scheme } = useAppTheme();
//
// The hook reads the system color scheme via React Native's `useColorScheme`
// and returns the matching palette. All other token objects (spacing, radii,
// typography, shadows, fontFamily) are scheme-independent and forwarded as-is.

import { useColorScheme } from "react-native";
import {
  lightColors,
  darkColors,
  spacing,
  radii,
  typography,
  shadows,
  fontFamily,
} from "../constants/tokens";

// Derive a mutable-string-value type so both lightColors and darkColors
// (which are `as const` with different literal strings) satisfy the same type.
type DeepWritable<T> = T extends object
  ? { [K in keyof T]: DeepWritable<T[K]> }
  : T extends string
    ? string
    : T;

export type AppColors = DeepWritable<typeof lightColors>;

export function useAppTheme() {
  const scheme = useColorScheme() ?? "light";
  const activeColors: AppColors =
    scheme === "dark" ? (darkColors as AppColors) : (lightColors as AppColors);

  return {
    scheme,
    colors: activeColors,
    spacing,
    radii,
    typography,
    shadows,
    fontFamily,
  } as const;
}
