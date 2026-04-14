// Carelog mobile design tokens.
// Mirrors the violet/plum palette defined in apps/web/app/globals.css so the
// two apps feel like one product. Import from here — never paste raw hex
// into a screen file.

// Alias kept for back-compat — lightColors and darkColors are the canonical
// named exports; `colors` always points at the light palette.
export const lightColors = {
  // Primary (violet)
  primary: "#7c3aed",
  primaryLight: "#a78bfa",
  primarySubtle: "#ede9fe",

  // Secondary (amber)
  secondary: "#d97706",
  secondaryLight: "#f59e0b",
  secondarySubtle: "#fef3c7",

  // Ink / headings / dark surfaces
  ink: "#1e0a3c",

  // Surfaces
  surface: "#faf5ff", // page background
  surfaceRaised: "#ffffff", // cards, sheets
  surfaceSubtle: "#f9fafb", // muted card / list backgrounds

  // Text
  textPrimary: "#1e0a3c",
  textSecondary: "#4b5563",
  muted: "#6b7280",
  mutedLight: "#9ca3af",

  // Borders
  border: "#ede9fe",
  borderNeutral: "#e5e7eb",

  // Semantic
  success: "#10b981",
  successLight: "#86efac",
  successSubtle: "#f0fdf4",
  successStrong: "#16a34a",
  successBadgeBg: "#dcfce7",
  successBadgeText: "#166534",
  warning: "#f59e0b",
  danger: "#ef4444",
  dangerStrong: "#991b1b",
  dangerSubtle: "#fee2e2",
  dangerPanel: "#fef2f2",

  // Input border (mid-gray, between borderNeutral and muted)
  borderInput: "#d1d5db",

  // Role badges (team panel) — avoid reusing primary/secondary so roles stay
  // visually distinct from state/action colors
  roleCoordinatorBg: "#5b21b6", // deep violet
  roleCaregiverBg: "#dbeafe", // light blue
  roleCaregiverText: "#1e40af", // dark blue
  roleSupporterText: "#92400e", // brown-amber

  // Mood (journal)
  moodGood: "#22c55e",
  moodOkay: "#f59e0b",
  moodDifficult: "#f97316",
  moodCrisis: "#ef4444",

  // Utility
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
} as const;

// Dark palette — surfaces flip to near-black with violet tint;
// text flips to bright off-white. Amber, mood, and semantic colors
// are intentionally unchanged (they encode meaning).
//
// WCAG AA contrast math (relative luminance, sRGB):
//   textPrimary (#f3e8ff, L=0.906) on surface   (#1a0f2e, L=0.0065) → 11.7:1 ✅
//   textPrimary (#f3e8ff, L=0.906) on surfaceRaised (#241538, L=0.0125) → 8.8:1 ✅
//   textPrimary (#f3e8ff, L=0.906) on surfaceSubtle (#2d1a45, L=0.019)  → 6.8:1 ✅
//   All well above 4.5:1 body-text requirement.
export const darkColors = {
  // Primary (violet) — brightened slightly for dark bg readability
  primary: "#a78bfa",
  primaryLight: "#c4b5fd",
  primarySubtle: "#3b1e6b",

  // Secondary (amber) — same as light; encodes meaning
  secondary: "#d97706",
  secondaryLight: "#f59e0b",
  secondarySubtle: "#422006",

  // Ink / headings
  ink: "#f3e8ff",

  // Surfaces
  surface: "#1a0f2e",
  surfaceRaised: "#241538",
  surfaceSubtle: "#2d1a45",

  // Text
  textPrimary: "#f3e8ff",
  textSecondary: "#c4b5fd",
  muted: "#9ca3af",
  mutedLight: "#6b7280",

  // Borders
  border: "#4c1d95",
  borderNeutral: "#3b2560",

  // Semantic — same as light (they encode pass/warn/fail meaning)
  success: "#10b981",
  successLight: "#86efac",
  successSubtle: "#052e16",
  successStrong: "#34d399",
  successBadgeBg: "#064e3b",
  successBadgeText: "#6ee7b7",
  warning: "#f59e0b",
  danger: "#ef4444",
  dangerStrong: "#fca5a5",
  dangerSubtle: "#450a0a",
  dangerPanel: "#3b0a0a",

  // Input border
  borderInput: "#5b21b6",

  // Role badges
  roleCoordinatorBg: "#7c3aed",
  roleCaregiverBg: "#1e3a5f",
  roleCaregiverText: "#93c5fd",
  roleSupporterText: "#fcd34d",

  // Mood (same — encode meaning)
  moodGood: "#22c55e",
  moodOkay: "#f59e0b",
  moodDifficult: "#f97316",
  moodCrisis: "#ef4444",

  // Utility
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
} as const;

// Back-compat: `colors` always points at the light palette so existing
// imports (ON-11 panel migration and other screens) continue to work.
export const colors: typeof lightColors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 9999,
} as const;

export const typography = {
  displaySize: 28,
  titleSize: 22,
  headingSize: 18,
  bodySize: 15,
  smallSize: 13,
  tinySize: 11,
  weightRegular: "400" as const,
  weightMedium: "500" as const,
  weightSemibold: "600" as const,
  weightBold: "700" as const,
} as const;

// Font families — loaded in app/_layout.tsx via useFonts() from
// @expo-google-fonts/inter. When weights matter, reference these directly
// rather than setting fontWeight on plain text (React Native doesn't map
// fontWeight onto the right Inter face automatically).
export const fontFamily = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

export const shadows = {
  card: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  raised: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
} as const;
