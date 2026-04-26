"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "../../../../lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ExpenseCategory =
  | "medication"
  | "supplies"
  | "equipment"
  | "home_modification"
  | "aide_hours"
  | "transport"
  | "food"
  | "other";

type Props = {
  orgId: string;
  recipientId: string;
  currentUserRole: string;
};

type ExpenseRow = {
  id: string;
  amount: number;
  currency: string;
  category: string;
  description: string;
  paid_by_name: string | null;
  incurred_at: string;
};

const CATEGORY_OPTS = [
  { value: "medication", label: "Medication" },
  { value: "supplies", label: "Supplies" },
  { value: "equipment", label: "Equipment" },
  { value: "home_modification", label: "Home modification" },
  { value: "aide_hours", label: "Aide hours" },
  { value: "transport", label: "Transport" },
  { value: "food", label: "Food" },
  { value: "other", label: "Other" },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  medication: "bg-[var(--color-primary-subtle)] text-primary",
  supplies: "bg-[var(--color-surface)] text-foreground/80",
  equipment: "bg-purple-100 text-purple-700",
  home_modification: "bg-amber-100 text-amber-700",
  aide_hours: "bg-green-100 text-green-700",
  transport: "bg-sky-100 text-sky-700",
  food: "bg-orange-100 text-orange-700",
  other: "bg-slate-100 text-slate-700",
};

export function ExpensePanel({ orgId, recipientId, currentUserRole }: Props) {
  const [category, setCategory] = useState("other");
  const [error, setError] = useState<string | null>(null);

  const canWrite =
    currentUserRole === "coordinator" || currentUserRole === "caregiver";
  const canDelete = currentUserRole === "coordinator";

  const utils = trpc.useUtils();

  const { data: expenses = [], isLoading } = trpc.expenses.list.useQuery({
    org_id: orgId,
    recipient_id: recipientId,
  });

  const createMutation = trpc.expenses.create.useMutation({
    onSuccess: () => {
      utils.expenses.list.invalidate();
      setError(null);
      toast.success("Expense logged");
    },
    onError: () => {
      setError("Failed to log expense. Please try again.");
      toast.error("Couldn't log expense");
    },
  });

  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => utils.expenses.list.invalidate(),
  });

  function handleSubmit(e: React.FormEvent) {
    const form = e.currentTarget as HTMLFormElement;
    e.preventDefault();
    const amountRaw = (form.elements.namedItem("amount") as HTMLInputElement)
      .value;
    const categoryVal = (
      form.elements.namedItem("category") as HTMLSelectElement
    ).value;
    const descriptionVal = (
      form.elements.namedItem("description") as HTMLInputElement
    ).value;
    const paidByVal = (
      form.elements.namedItem("paid_by_name") as HTMLInputElement
    ).value;
    const dateVal = (form.elements.namedItem("incurred_at") as HTMLInputElement)
      .value;

    const amountNum = parseFloat(amountRaw);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }

    createMutation.mutate({
      org_id: orgId,
      recipient_id: recipientId,
      amount: amountNum,
      category: categoryVal as ExpenseCategory,
      description: descriptionVal,
      paid_by_name: paidByVal || undefined,
      incurred_at: dateVal || undefined,
    });

    form.reset();
    setCategory("other");
  }

  // 30-day category totals
  const today = new Date();
  const cutoffStr = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 30,
  )
    .toISOString()
    .slice(0, 10);
  const totals: Record<string, number> = {};
  for (const e of expenses) {
    if (e.incurred_at >= cutoffStr) {
      totals[e.category] = (totals[e.category] ?? 0) + Number(e.amount);
    }
  }
  const totalCategories = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <div className="w-full px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground/80">
          Shared expenses
        </span>
      </div>

      <div className="px-4 pb-4 border-t border-border space-y-4">
        {isLoading && (
          <p className="text-sm text-muted-foreground pt-3">Loading...</p>
        )}

        {!isLoading && expenses.length === 0 && (
          <p className="text-sm text-muted-foreground pt-3">
            No expenses logged yet.
          </p>
        )}

        {!isLoading && expenses.length > 0 && (
          <>
            <ul className="divide-y divide-border pt-2">
              {expenses.map((expense: ExpenseRow) => (
                <li
                  key={expense.id}
                  className="py-2 flex items-start justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={
                          "text-xs px-2 py-0.5 rounded-full font-medium " +
                          (CATEGORY_COLORS[expense.category] ??
                            "bg-[var(--color-surface)] text-foreground/80")
                        }
                      >
                        {expense.category.replaceAll("_", " ")}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {"$" + Number(expense.amount).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 mt-0.5 truncate">
                      {expense.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {expense.incurred_at}
                      {expense.paid_by_name ? " · " + expense.paid_by_name : ""}
                    </p>
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() =>
                        deleteMutation.mutate({
                          id: expense.id,
                          org_id: orgId,
                        })
                      }
                      className="text-muted-foreground/50 hover:text-[var(--color-danger)] transition-colors flex-shrink-0"
                      aria-label="Delete expense"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {totalCategories.length > 0 && (
              <div className="bg-[var(--color-surface)] rounded-lg px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Last 30 days by category
                </p>
                <div className="flex flex-wrap gap-2">
                  {totalCategories.map(([cat, total]) => (
                    <span key={cat} className="text-xs text-foreground/80">
                      {cat.replaceAll("_", " ")}: {"$" + total.toFixed(2)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {canWrite && (
          <form
            onSubmit={handleSubmit}
            className="space-y-2 pt-2 border-t border-border"
          >
            <p className="text-xs font-medium text-muted-foreground">
              Log expense
            </p>
            {error && (
              <p className="text-xs text-[var(--color-danger)]">{error}</p>
            )}
            <div className="flex gap-2">
              <Input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Amount"
                required
                className="w-24"
              />
              <select
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex-1 text-sm border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring bg-card text-foreground"
              >
                {CATEGORY_OPTS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <Input
              name="description"
              type="text"
              placeholder="Description"
              required
            />
            <div className="flex gap-2">
              <Input
                name="paid_by_name"
                type="text"
                placeholder="Paid by (optional)"
                className="flex-1"
              />
              <Input name="incurred_at" type="date" defaultValue={todayStr} />
            </div>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full"
              size="sm"
            >
              {createMutation.isPending ? "Saving..." : "Log expense"}
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}
