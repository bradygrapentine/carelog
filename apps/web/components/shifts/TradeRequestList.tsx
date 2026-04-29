"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CardContent } from "@/components/ui/card";
import { TintedCard, TintedCardHeader } from "@/components/ui/tinted-card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { TradeRequestCard } from "./TradeRequestCard";
import { TradeRequestForm } from "./TradeRequestForm";

// Mount: use in shift detail view when it exists

type Props = {
  shiftId: string;
  orgId: string;
  currentUserId: string;
  isCoordinator?: boolean;
};

export function TradeRequestList({
  shiftId,
  orgId,
  currentUserId,
  isCoordinator,
}: Props) {
  const [showForm, setShowForm] = useState(false);

  const { data, refetch, isLoading } = trpc.shiftTradeRequests.list.useQuery({
    shiftId,
  });

  const createMutation = trpc.shiftTradeRequests.create.useMutation({
    onSuccess: () => {
      setShowForm(false);
      void refetch();
    },
  });

  const respondMutation = trpc.shiftTradeRequests.respond.useMutation({
    onSuccess: () => void refetch(),
  });

  const forceOverrideMutation =
    trpc.shiftTradeRequests.forceOverride.useMutation({
      onSuccess: () => void refetch(),
    });

  function handleFormSubmit(
    targetUserId: string | undefined,
    message: string | undefined,
  ) {
    createMutation.mutate({ shiftId, targetUserId, message });
  }

  function handleRespond(requestId: string, action: "accept" | "decline") {
    respondMutation.mutate({ requestId, action });
  }

  function handleForceOverride(
    requestId: string,
    action: "accept" | "decline" | "cancel",
  ) {
    forceOverrideMutation.mutate({ requestId, action, orgId });
  }

  const trades = data ?? [];

  return (
    <TintedCard>
      <TintedCardHeader
        tone="dark"
        title="Trade Requests"
        action={
          !showForm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(true)}
              className="h-7 px-2 text-xs text-[var(--color-primary)] dark:text-gray-300 hover:bg-[var(--color-primary-subtle)] dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 dark:focus:ring-offset-gray-700"
            >
              <Plus className="h-3 w-3 mr-1" aria-hidden="true" />
              Request Trade
            </Button>
          )
        }
      />

      <CardContent className="pt-2 space-y-3">
        {/* Inline form */}
        {showForm && (
          <TradeRequestForm
            shiftId={shiftId}
            onSubmit={handleFormSubmit}
            onCancel={() => setShowForm(false)}
            disabled={createMutation.isPending}
          />
        )}

        {/* Loading */}
        {isLoading && (
          <p
            className="text-sm text-[var(--color-muted)] dark:text-gray-400"
            aria-live="polite"
          >
            Loading trade requests…
          </p>
        )}

        {/* List */}
        {!isLoading && trades.length === 0 && !showForm && (
          <p className="text-sm text-[var(--color-muted)] dark:text-gray-400">
            No trade requests for this shift.
          </p>
        )}

        {!isLoading &&
          trades.map((trade) => (
            <TradeRequestCard
              key={trade.id}
              trade={trade}
              currentUserId={currentUserId}
              isCoordinator={isCoordinator}
              onRespond={handleRespond}
              onForceOverride={isCoordinator ? handleForceOverride : undefined}
            />
          ))}
      </CardContent>
    </TintedCard>
  );
}
