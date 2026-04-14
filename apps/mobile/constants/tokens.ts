// Carelog mobile design tokens.
// Mirrors the violet/plum palette defined in apps/web/app/globals.css so the
// two apps feel like one product. Import from here — never paste raw hex
// into a screen file.

export const colors = {
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
