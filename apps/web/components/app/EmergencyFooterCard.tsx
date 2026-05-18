"use client";

import { useState } from "react";
import { AlertTriangle, Phone, Pencil } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useEditMode } from "@/hooks/useEditMode";
import { formatMutationError } from "@/lib/formatMutationError";

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
  /** UX-105b: when true, renders a coordinator-only inline edit toggle. */
  editable?: boolean;
  /** Required when editable=true; identifies the recipient for the mutation. */
  recipientId?: string;
  /** Required when editable=true; org context for the membership gate. */
  orgId?: string;
};

const PHONE_REGEX = /^\+?[\d\s\-()]{7,20}$/;

export function EmergencyFooterCard({
  dnrStatus,
  primaryContact,
  hospital,
  className,
  editable = false,
  recipientId,
  orgId,
}: EmergencyFooterCardProps) {
  const [dnrInput, setDnrInput] = useState(dnrStatus ?? "");
  const [hospitalInput, setHospitalInput] = useState(hospital ?? "");
  const [nameInput, setNameInput] = useState(primaryContact?.name ?? "");
  const [relInput, setRelInput] = useState(primaryContact?.relationship ?? "");
  const [phoneInput, setPhoneInput] = useState(primaryContact?.phone ?? "");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const editMode = useEditMode({
    onCancel: () => {
      setDnrInput(dnrStatus ?? "");
      setHospitalInput(hospital ?? "");
      setNameInput(primaryContact?.name ?? "");
      setRelInput(primaryContact?.relationship ?? "");
      setPhoneInput(primaryContact?.phone ?? "");
      setPhoneError(null);
    },
  });

  const mutation = trpc.recipients.updateEmergencyInfo.useMutation({
    onSuccess: () => {
      setPhoneError(null);
      editMode.handlers.onSuccess();
    },
    onError: (err) => {
      editMode.handlers.onError({ message: formatMutationError(err) });
    },
  });

  const canEdit = editable && Boolean(recipientId) && Boolean(orgId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId || !orgId) return;
    // Soft client validation: phone is optional, but if provided must match.
    if (phoneInput.trim() && !PHONE_REGEX.test(phoneInput.trim())) {
      setPhoneError("Enter a phone like +1 555 123 4567 or leave blank.");
      return;
    }
    setPhoneError(null);
    mutation.mutate({
      org_id: orgId,
      recipient_id: recipientId,
      dnr_status: dnrInput,
      hospital: hospitalInput,
      primary_contact: {
        name: nameInput,
        relationship: relInput,
        phone: phoneInput,
      },
    });
  };

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
      <div className="mb-3 flex items-center justify-between">
        <p className="eyebrow-mono flex items-center gap-1.5 text-[var(--color-tertiary)]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Emergency
        </p>
        {canEdit && !editMode.isEditing && (
          <button
            type="button"
            onClick={() => editMode.open()}
            aria-label="Edit emergency information"
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--color-tertiary)] hover:text-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-tertiary)] focus:ring-offset-1"
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            Edit
          </button>
        )}
      </div>

      {canEdit && editMode.isEditing ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="emergency-dnr"
              className="block text-xs font-medium text-[var(--color-text-primary)] mb-1"
            >
              Code status
            </label>
            <input
              id="emergency-dnr"
              type="text"
              value={dnrInput}
              onChange={(e) => setDnrInput(e.target.value)}
              disabled={mutation.isPending}
              maxLength={120}
              className="w-full rounded border border-[var(--color-border)] bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tertiary)]"
              placeholder='e.g. "Full code" or "DNR"'
            />
          </div>
          <div>
            <label
              htmlFor="emergency-hospital"
              className="block text-xs font-medium text-[var(--color-text-primary)] mb-1"
            >
              Hospital
            </label>
            <input
              id="emergency-hospital"
              type="text"
              value={hospitalInput}
              onChange={(e) => setHospitalInput(e.target.value)}
              disabled={mutation.isPending}
              maxLength={120}
              className="w-full rounded border border-[var(--color-border)] bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tertiary)]"
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-[var(--color-text-primary)] mb-1">
              Primary contact
            </legend>
            <div>
              <label
                htmlFor="emergency-contact-name"
                className="block text-xs text-[var(--color-muted)] mb-1"
              >
                Name (leave blank to clear)
              </label>
              <input
                id="emergency-contact-name"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                disabled={mutation.isPending}
                maxLength={120}
                className="w-full rounded border border-[var(--color-border)] bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tertiary)]"
              />
            </div>
            <div>
              <label
                htmlFor="emergency-contact-rel"
                className="block text-xs text-[var(--color-muted)] mb-1"
              >
                Relationship
              </label>
              <input
                id="emergency-contact-rel"
                type="text"
                value={relInput}
                onChange={(e) => setRelInput(e.target.value)}
                disabled={mutation.isPending}
                maxLength={60}
                className="w-full rounded border border-[var(--color-border)] bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tertiary)]"
              />
            </div>
            <div>
              <label
                htmlFor="emergency-contact-phone"
                className="block text-xs text-[var(--color-muted)] mb-1"
              >
                Phone
              </label>
              <input
                id="emergency-contact-phone"
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                disabled={mutation.isPending}
                maxLength={40}
                className="w-full rounded border border-[var(--color-border)] bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tertiary)]"
                placeholder="+1 555 123 4567"
              />
              {phoneError && (
                <p
                  role="alert"
                  className="mt-1 text-xs text-[var(--color-danger)]"
                >
                  {phoneError}
                </p>
              )}
            </div>
          </fieldset>
          {editMode.error && (
            <p role="alert" className="text-xs text-[var(--color-danger)]">
              {editMode.error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => editMode.cancel()}
              disabled={mutation.isPending}
              className="rounded px-3 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-tertiary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded bg-[var(--color-tertiary)] px-3 py-1 text-xs font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-tertiary)] focus:ring-offset-1 disabled:opacity-50"
            >
              {mutation.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : (
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
      )}
    </section>
  );
}
