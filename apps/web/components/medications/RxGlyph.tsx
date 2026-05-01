type RxGlyphProps = {
  /** Pixel size of the glyph; controls font-size. */
  size?: number;
  className?: string;
  /** Provide an aria-label when used decoratively next to the word "medication"; otherwise the default label is "Medication". */
  ariaLabel?: string;
};

export function RxGlyph({
  size = 16,
  className,
  ariaLabel = "Medication",
}: RxGlyphProps) {
  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={`italic${className ? ` ${className}` : ""}`}
      style={{
        fontFamily: "var(--font-display)",
        fontSize: size,
        color: "currentColor",
      }}
    >
      ℞
    </span>
  );
}
