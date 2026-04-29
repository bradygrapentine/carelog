"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "../../../../lib/trpc";
import { CardContent } from "@/components/ui/card";
import { TintedCard, TintedCardHeader } from "@/components/ui/tinted-card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type Props = {
  orgId: string;
  recipientId: string;
  currentUserRole: string;
};

type PlanData = {
  healthcare_proxy: string | null;
  resuscitation_pref: string | null;
  funeral_pref: string | null;
  legacy_message: string | null;
  attorney_name: string | null;
  attorney_contact: string | null;
};

type DocRow = {
  id: string;
  display_name: string;
  doc_type: string;
};

const RESUS_OPTS = [
  { value: "full", label: "Full resuscitation" },
  { value: "dnr", label: "Do Not Resuscitate (DNR)" },
  { value: "dnr_comfort_only", label: "DNR — Comfort care only" },
];

export function EolPlanner({ orgId, recipientId, currentUserRole }: Props) {
  // Hooks must be called unconditionally — role guard applied after
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: plan, isLoading: planLoading } = trpc.eolPlan.get.useQuery(
    { org_id: orgId, recipient_id: recipientId },
    { enabled: currentUserRole === "coordinator" },
  );

  const { data: allDocs = [] } = trpc.documents.list.useQuery(
    { org_id: orgId, recipient_id: recipientId },
    { enabled: currentUserRole === "coordinator" },
  );

  const upsertMutation = trpc.eolPlan.upsert.useMutation({
    onSuccess: () => {
      utils.eolPlan.get.invalidate();
      setEditing(false);
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 4000);
      toast.success("Plan saved");
    },
    onError: () => {
      setError("The plan didn't save. Try again.");
      toast.error("Couldn't save plan");
    },
  });

  if (currentUserRole !== "coordinator") return null;

  const advanceDocs = (allDocs as DocRow[]).filter(
    (d) => d.doc_type === "advance_directive",
  );

  function handleSubmit(e: React.FormEvent) {
    const form = e.currentTarget as HTMLFormElement;
    e.preventDefault();

    const getValue = (name: string) =>
      (
        form.elements.namedItem(name) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement
          | null
      )?.value || undefined;

    upsertMutation.mutate({
      org_id: orgId,
      recipient_id: recipientId,
      healthcare_proxy: getValue("healthcare_proxy"),
      resuscitation_pref: getValue("resuscitation_pref") as
        | "full"
        | "dnr"
        | "dnr_comfort_only"
        | undefined,
      funeral_pref: getValue("funeral_pref"),
      legacy_message: getValue("legacy_message"),
      attorney_name: getValue("attorney_name"),
      attorney_contact: getValue("attorney_contact"),
    });
  }

  return (
    <TintedCard className="border-[var(--color-danger)]/30">
      <TintedCardHeader
        title="End-of-life plan"
        action={
          <span className="text-xs bg-[var(--color-danger-subtle)] text-[var(--color-danger)] px-2 py-0.5 rounded-full">
            Coordinator only
          </span>
        }
      />

      <CardContent className="pt-2 space-y-4">
        {planLoading && (
          <p className="text-sm text-muted-foreground pt-3">Loading...</p>
        )}

        {!planLoading && !editing && (
          <>
            {!plan ? (
              <div className="pt-3">
                <p className="text-sm text-muted-foreground mb-3">
                  No end-of-life plan on file yet. Create one to document
                  wishes, preferences, and key contacts.
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setEditing(true)}
                >
                  Create plan
                </Button>
              </div>
            ) : (
              <div className="pt-3 space-y-3">
                {saved && (
                  <p className="text-xs text-emerald-600">
                    Saved. The team will never see this until you share it.
                  </p>
                )}
                <dl className="space-y-2 text-sm">
                  {plan.healthcare_proxy && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        Healthcare proxy
                      </dt>
                      <dd className="text-foreground/80">
                        {plan.healthcare_proxy}
                      </dd>
                    </div>
                  )}
                  {plan.resuscitation_pref && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        Resuscitation preference
                      </dt>
                      <dd className="text-foreground/80">
                        {RESUS_OPTS.find(
                          (o) => o.value === plan.resuscitation_pref,
                        )?.label ?? plan.resuscitation_pref}
                      </dd>
                    </div>
                  )}
                  {plan.funeral_pref && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        Funeral preferences
                      </dt>
                      <dd className="text-foreground/80">
                        {plan.funeral_pref}
                      </dd>
                    </div>
                  )}
                  {plan.legacy_message && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        Legacy message
                      </dt>
                      <dd className="text-foreground/80 whitespace-pre-wrap">
                        {plan.legacy_message}
                      </dd>
                    </div>
                  )}
                  {(plan.attorney_name || plan.attorney_contact) && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        Attorney
                      </dt>
                      <dd className="text-foreground/80">
                        {[plan.attorney_name, plan.attorney_contact]
                          .filter(Boolean)
                          .join(" · ")}
                      </dd>
                    </div>
                  )}
                </dl>

                {advanceDocs.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Advance directives on file
                    </p>
                    <ul className="space-y-1">
                      {advanceDocs.map((doc) => {
                        const href = "/api/documents/" + doc.id + "/download";
                        const label = doc.display_name + " →";
                        return (
                          <li key={doc.id}>
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              {label}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-xs text-muted-foreground hover:text-foreground/80 transition-colors"
                >
                  Edit plan
                </button>
              </div>
            )}
          </>
        )}

        {!planLoading && editing && (
          <form onSubmit={handleSubmit} className="pt-3 space-y-3">
            {error && (
              <p className="text-xs text-[var(--color-danger)]">{error}</p>
            )}

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Healthcare proxy (name + contact)
              </label>
              <Input
                name="healthcare_proxy"
                type="text"
                defaultValue={plan?.healthcare_proxy ?? ""}
                placeholder="e.g. Jane Smith — 555-0199"
              />
            </div>

            <div>
              <label
                htmlFor="resuscitation_pref"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Resuscitation preference
              </label>
              <select
                id="resuscitation_pref"
                name="resuscitation_pref"
                defaultValue={plan?.resuscitation_pref ?? ""}
                className="w-full text-sm border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring bg-card text-foreground"
              >
                <option value="">Not specified</option>
                {RESUS_OPTS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Funeral preferences
              </label>
              <Textarea
                name="funeral_pref"
                defaultValue={plan?.funeral_pref ?? ""}
                rows={2}
                placeholder="Cremation, burial location, service preferences..."
                className="resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Legacy message to the family
              </label>
              <Textarea
                name="legacy_message"
                defaultValue={plan?.legacy_message ?? ""}
                rows={3}
                placeholder="A personal message..."
                className="resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Attorney name
              </label>
              <Input
                name="attorney_name"
                type="text"
                defaultValue={plan?.attorney_name ?? ""}
                placeholder="Attorney name"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Attorney contact
              </label>
              <Input
                name="attorney_contact"
                type="text"
                defaultValue={plan?.attorney_contact ?? ""}
                placeholder="Email or phone"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={upsertMutation.isPending}
                className="flex-1"
                size="sm"
              >
                {upsertMutation.isPending ? "Saving..." : "Save plan"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </TintedCard>
  );
}
