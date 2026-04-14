"use client";

import { useState } from "react";
import { trpc } from "../../../../lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type Props = {
  orgId: string;
  recipientId: string;
  currentUserRole: string;
};

export function MedicationPanel({
  orgId,
  recipientId,
  currentUserRole,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [drugName, setDrugName] = useState("");
  const [dosage, setDosage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [pharmacy, setPharmacy] = useState("");
  const [supply, setSupply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [needsRefillOnly, setNeedsRefillOnly] = useState(false);

  const isCoordinator = currentUserRole === "coordinator";
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.medications.list.useQuery({
    org_id: orgId,
    recipient_id: recipientId,
  });

  const createMutation = trpc.medications.create.useMutation({
    onSuccess: () => {
      utils.medications.list.invalidate();
      setShowForm(false);
      setDrugName("");
      setDosage("");
      setInstructions("");
      setPharmacy("");
      setSupply("");
      setError(null);
    },
    onError: () => setError("Something went wrong. Please try again."),
  });

  const deleteMutation = trpc.medications.delete.useMutation({
    onSuccess: () => utils.medications.list.invalidate(),
  });

  const medications = data ?? [];

  const filteredMedications = medications.filter(
    (m: Record<string, unknown>) => {
      const name = (m.drug_name as string) ?? "";
      const supplyDays = m.supply_days_remaining as number | null;
      const matchesSearch = search.trim()
        ? name.toLowerCase().includes(search.trim().toLowerCase())
        : true;
      const matchesRefill = needsRefillOnly
        ? typeof supplyDays === "number" && supplyDays <= 7
        : true;
      return matchesSearch && matchesRefill;
    },
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dn = drugName.trim();
    const dos = dosage.trim();
    const inst = instructions.trim() || undefined;
    const ph = pharmacy.trim() || undefined;
    const sup = supply ? parseInt(supply, 10) : undefined;

    setError(null);
    createMutation.mutate({
      org_id: orgId,
      recipient_id: recipientId,
      drug_name: dn,
      dosage: dos,
      instructions: inst,
      pharmacy: ph,
      supply_days_remaining: sup,
    });
  }

  const addForm = isCoordinator ? (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="med-drug"
            className="block text-xs font-medium text-foreground/80 mb-1"
          >
            Drug name *
          </label>
          <Input
            id="med-drug"
            data-testid="medication-name-input"
            type="text"
            value={drugName}
            onChange={(e) => setDrugName(e.target.value)}
            required
            placeholder="e.g. Lisinopril"
          />
        </div>
        <div>
          <label
            htmlFor="med-dosage"
            className="block text-xs font-medium text-foreground/80 mb-1"
          >
            Dosage *
          </label>
          <Input
            id="med-dosage"
            data-testid="medication-dosage-input"
            type="text"
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            required
            placeholder="e.g. 10mg once daily"
          />
          <p className="text-xs text-muted-foreground mt-1">
            e.g. 10mg, 1 tablet, 5ml
          </p>
        </div>
      </div>

      <div>
        <label
          htmlFor="med-instructions"
          className="block text-xs font-medium text-foreground/80 mb-1"
        >
          Instructions{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Input
          id="med-instructions"
          type="text"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Take with food"
        />
        <p className="text-xs text-muted-foreground mt-1">
          When and how to administer — e.g. "Take with food", "Morning only".
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="med-pharmacy"
            className="block text-xs font-medium text-foreground/80 mb-1"
          >
            Pharmacy{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </label>
          <Input
            id="med-pharmacy"
            type="text"
            value={pharmacy}
            onChange={(e) => setPharmacy(e.target.value)}
            placeholder="CVS on Main St"
          />
        </div>
        <div>
          <label
            htmlFor="med-supply"
            className="block text-xs font-medium text-foreground/80 mb-1"
          >
            Days remaining{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </label>
          <Input
            id="med-supply"
            type="number"
            min="0"
            value={supply}
            onChange={(e) => setSupply(e.target.value)}
            placeholder="30"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Days of medication left before a refill is needed.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <Separator />

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setShowForm(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!drugName || !dosage || createMutation.isPending}
        >
          {createMutation.isPending ? "Adding..." : "Add medication"}
        </Button>
      </div>
    </form>
  ) : null;

  return (
    <Card className="shadow-sm gap-2">
      <CardHeader className="-mt-4 px-4 py-3 flex flex-row items-center justify-between space-y-0 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
        <CardTitle className="text-sm">Medications</CardTitle>
        {/* Mobile-only toggle */}
        {isCoordinator && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-sm text-muted-foreground hover:text-foreground/80 transition-colors"
          >
            + Add
          </button>
        )}
      </CardHeader>

      <CardContent className="pt-4">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}

        {!isLoading && medications.length === 0 && (
          <p className="text-sm text-muted-foreground mb-3">
            No medications added yet.
          </p>
        )}

        {medications.length > 0 && (
          <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-center">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search medications by name…"
              aria-label="Search medications"
              className="flex-1 text-sm"
            />
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={needsRefillOnly}
                onChange={(e) => setNeedsRefillOnly(e.target.checked)}
                className="rounded border-border"
              />
              Needs refill only
            </label>
          </div>
        )}

        {medications.length > 0 && filteredMedications.length === 0 && (
          <p className="text-sm text-muted-foreground mb-3">
            No medications match your filters.
          </p>
        )}

        {filteredMedications.length > 0 && (
          <div
            data-testid="medication-list"
            className="grid gap-2 mb-4 md:grid-cols-2"
          >
            {filteredMedications.map((med: Record<string, unknown>) => {
              const medId = med.id as string;
              const name = med.drug_name as string;
              const dos = med.dosage as string;
              const instStr = med.instructions as string | null;
              const pharmStr = med.pharmacy as string | null;
              const supplyDays = med.supply_days_remaining as number | null;
              const isLow = typeof supplyDays === "number" && supplyDays <= 7;

              return (
                <div
                  key={medId}
                  data-testid="medication-item"
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-[var(--color-surface)] p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {dos}
                      </span>
                      {isLow && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          Low supply
                        </span>
                      )}
                    </div>
                    {instStr && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {instStr}
                      </p>
                    )}
                    {pharmStr && (
                      <p className="text-xs text-muted-foreground">
                        {pharmStr}
                      </p>
                    )}
                    {typeof supplyDays === "number" && (
                      <p className="text-xs text-muted-foreground">
                        {supplyDays} days remaining
                      </p>
                    )}
                  </div>
                  {isCoordinator && (
                    <button
                      type="button"
                      onClick={() =>
                        deleteMutation.mutate({ id: medId, org_id: orgId })
                      }
                      disabled={deleteMutation.isPending}
                      className="text-xs text-[var(--color-danger)] hover:text-[var(--color-danger)] ml-3 shrink-0"
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isCoordinator && (
          <>
            {/* Toggle button: mobile only */}
            {!showForm && (
              <button
                type="button"
                data-testid="add-medication-btn"
                onClick={() => setShowForm(true)}
                className="text-sm text-muted-foreground hover:text-foreground/80 transition-colors"
              >
                + Add medication
              </button>
            )}
            {/* Form: on mobile shown when showForm; on desktop always shown */}
            <div className={"mt-2 " + (showForm ? "block" : "hidden")}>
              {medications.length > 0 && <Separator className="mb-4" />}
              {addForm}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
