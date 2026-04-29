import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Standard Save/Cancel form footer used across journal panels and shift forms.
 *
 * Default layout: `flex items-center justify-between` — ghost Cancel on the
 * left, primary Submit on the right. When `onCancel` is omitted, the row
 * renders only the Submit (right-aligned via justify-end).
 *
 * Intentionally separate from <AlertDialogFooter> (destructive confirms have
 * different semantics — see TD-90 / UX-052).
 */
export type FormActionRowProps = {
  /** Submit button label. Defaults to "Save". */
  submitLabel?: string;
  /** Disables submit; canonical "in-flight" signal. */
  loading?: boolean;
  /** Disables submit independently of `loading` (e.g. invalid form state). */
  disabled?: boolean;
  /** When provided, renders a ghost Cancel button that calls this on click. */
  onCancel?: () => void;
  /** Cancel button label. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Wrapper className override / extension. */
  className?: string;
  /** Submit button size — matches the shadcn Button `size` variant. */
  size?: "default" | "sm";
};

export function FormActionRow({
  submitLabel = "Save",
  loading = false,
  disabled = false,
  onCancel,
  cancelLabel = "Cancel",
  className,
  size = "default",
}: FormActionRowProps) {
  return (
    <div
      className={cn(
        "flex items-center",
        onCancel ? "justify-between" : "justify-end",
        className,
      )}
    >
      {onCancel ? (
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {cancelLabel}
        </Button>
      ) : null}
      <Button type="submit" size={size} disabled={loading || disabled}>
        {submitLabel}
      </Button>
    </div>
  );
}
