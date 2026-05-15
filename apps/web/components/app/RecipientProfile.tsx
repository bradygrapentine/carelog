/**
 * RecipientProfile — UX-060
 *
 * Pure presentational profile card for a care recipient. Render-only:
 * the caller is responsible for resolving identity through
 * `identityRepository.resolveIdentity` and passing already-decrypted name +
 * age. This component never reads the `recipients` or `identity_vault`
 * tables itself.
 *
 * v1 scope (per UX-060 brief): avatar, name, mood badge, age, conditions,
 * primary caregivers, "About" paragraph. Document upload, care-team CRUD,
 * emergency contacts, and the editorial hero gradient ship in follow-up rows.
 */

import * as React from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOOD_BADGE_CLS, MOOD_LABELS, type Mood } from "@/lib/mood";

export type RecipientProfileCaregiver = {
  /** Stable id from team_members; used as React key. */
  id: string;
  /** Already-resolved display name (PHI — caller resolves via identityRepository). */
  name: string;
  /** Optional role hint, e.g. "Daughter · primary". */
  role?: string;
};

export type RecipientProfileProps = {
  /** Already-resolved recipient name (PHI — caller resolves via identityRepository). */
  name: string;
  /** Already-derived age in years (caller computes from DOB after resolveIdentity). */
  age?: number;
  /** Current mood key; renders a tinted badge. Omit to hide. */
  mood?: Mood;
  /** Diagnosed conditions (presented as a bulleted list). */
  conditions?: readonly string[];
  /** Primary caregivers (presented as a small list). */
  caregivers?: readonly RecipientProfileCaregiver[];
  /** Family-written "About" paragraph. */
  about?: string;
  /** Optional avatar URL. When absent, falls back to the recipient's initial. */
  avatarUrl?: string;
};

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function RecipientProfile({
  name,
  age,
  mood,
  conditions,
  caregivers,
  about,
  avatarUrl,
}: RecipientProfileProps) {
  const hasConditions = !!conditions && conditions.length > 0;
  const hasCaregivers = !!caregivers && caregivers.length > 0;

  return (
    <Card
      className="shadow-sm gap-2"
      aria-labelledby="recipient-profile-name"
      data-testid="recipient-profile"
    >
      <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
        <div className="flex items-center gap-4">
          <div
            className="relative shrink-0 h-16 w-16 sm:h-20 sm:w-20 rounded-2xl overflow-hidden bg-[var(--color-tertiary-subtle)] flex items-center justify-center text-[var(--color-tertiary)] font-semibold text-2xl"
            aria-hidden={avatarUrl ? undefined : "true"}
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={`${name} avatar`}
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : (
              <span data-testid="recipient-profile-initials">
                {initials(name)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle
              id="recipient-profile-name"
              className="text-base sm:text-lg font-semibold text-[var(--color-ink)] truncate"
            >
              {name}
            </CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              {typeof age === "number" ? (
                <span data-testid="recipient-profile-age">{age} years old</span>
              ) : null}
              {mood ? (
                <span
                  data-testid="recipient-profile-mood"
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${MOOD_BADGE_CLS[mood]}`}
                >
                  {MOOD_LABELS[mood]}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2 space-y-4">
        {about ? (
          <section aria-labelledby="recipient-profile-about-heading">
            <h3
              id="recipient-profile-about-heading"
              className="eyebrow-mono mb-1"
            >
              About
            </h3>
            <p className="text-sm leading-relaxed text-[var(--color-text-primary)]">
              {about}
            </p>
          </section>
        ) : null}

        {hasConditions ? (
          <section aria-labelledby="recipient-profile-conditions-heading">
            <h3
              id="recipient-profile-conditions-heading"
              className="eyebrow-mono mb-1"
            >
              Conditions
            </h3>
            <ul
              aria-label="Conditions"
              className="list-disc pl-5 text-sm text-[var(--color-text-primary)] space-y-0.5"
            >
              {conditions!.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {hasCaregivers ? (
          <section aria-labelledby="recipient-profile-caregivers-heading">
            <h3
              id="recipient-profile-caregivers-heading"
              className="eyebrow-mono mb-1"
            >
              Primary caregivers
            </h3>
            <ul
              aria-label="Primary caregivers"
              className="text-sm text-[var(--color-text-primary)] divide-y divide-[var(--color-border)]"
            >
              {caregivers!.map((c) => (
                <li key={c.id} className="py-1.5">
                  <span className="font-medium">{c.name}</span>
                  {c.role ? (
                    <span className="text-[var(--color-text-secondary)]">
                      {" · "}
                      {c.role}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default RecipientProfile;
