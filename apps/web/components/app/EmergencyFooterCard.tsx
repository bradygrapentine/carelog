import { AlertTriangle, Phone } from "lucide-react";

type EmergencyContact = {
  name: string;
  relationship?: string;
  phone?: string;
};

type EmergencyFooterCardProps = {
  /** DNR status as a short human-readable phrase, e.g. "DNR — full code declined" or "Full code". */
  dnrStatus?: string;
  /** Pre-resolved primary emergency contact. Caller resolves the name via identityRepository. */
  primaryContact?: EmergencyContact;
  /** Hospital preference, e.g. "Memorial Cooper". */
  hospital?: string;
  className?: string;
};

export function EmergencyFooterCard({
  dnrStatus,
  primaryContact,
  hospital,
  className,
}: EmergencyFooterCardProps) {
  return (
    <section
      aria-label="Emergency information"
      className={[
        "rounded-xl border border-[var(--color-tertiary-subtle)] bg-[var(--color-tertiary-subtle)] p-4",
        className ?? "",
      ]
        .join(" ")
        .trim()}
    >
      <p className="eyebrow-mono mb-3 flex items-center gap-1.5 text-[var(--color-tertiary)]">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Emergency
      </p>

      <dl className="space-y-2 text-sm">
        {dnrStatus && (
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 font-mono text-xs uppercase tracking-wide text-[var(--color-muted)]">
              Code status
            </dt>
            <dd className="text-[var(--text-primary)]">{dnrStatus}</dd>
          </div>
        )}

        {primaryContact && (
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 font-mono text-xs uppercase tracking-wide text-[var(--color-muted)]">
              Contact
            </dt>
            <dd className="flex-1 text-[var(--text-primary)]">
              <span>{primaryContact.name}</span>
              {primaryContact.relationship && (
                <span className="text-[var(--color-muted)]">
                  {" "}
                  · {primaryContact.relationship}
                </span>
              )}
              {primaryContact.phone && (
                <a
                  href={`tel:${primaryContact.phone}`}
                  aria-label={`Call ${primaryContact.name}`}
                  className="ml-2 inline-flex items-center gap-1 font-mono text-xs text-[var(--color-tertiary)] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-tertiary)] focus:ring-offset-1"
                >
                  <Phone className="h-3 w-3" aria-hidden="true" />
                  {primaryContact.phone}
                </a>
              )}
            </dd>
          </div>
        )}

        {hospital && (
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 font-mono text-xs uppercase tracking-wide text-[var(--color-muted)]">
              Hospital
            </dt>
            <dd className="text-[var(--text-primary)]">{hospital}</dd>
          </div>
        )}

        {!dnrStatus && !primaryContact && !hospital && (
          <p className="text-[var(--color-muted)]">
            No emergency information recorded.
          </p>
        )}
      </dl>
    </section>
  );
}
