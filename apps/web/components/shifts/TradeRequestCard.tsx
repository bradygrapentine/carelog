"use client";

import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type TradeStatus = "open" | "accepted" | "declined" | "expired" | "cancelled";

type Trade = {
  id: string;
  shift_id: string;
  org_id: string;
  requested_by: string;
  target_user_id: string | null;
  status: TradeStatus;
  message: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  expires_at: string;
};

type Props = {
  trade: Trade;
  currentUserId: string;
  isCoordinator?: boolean;
  onRespond: (requestId: string, action: "accept" | "decline") => void;
  onForceOverride?: (
    requestId: string,
    action: "accept" | "decline" | "cancel",
  ) => void;
};

const STATUS_BADGE: Record<TradeStatus, { label: string; className: string }> =
  {
    open: {
      label: "Open",
      className:
        "bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border border-[var(--color-border)]",
    },
    accepted: {
      label: "Accepted",
      className:
        "bg-[var(--color-success)]/10 dark:bg-[var(--color-success)]/20 text-[var(--color-success)] border border-[var(--color-success)]/30 dark:border-[var(--color-success)]/50",
    },
    declined: {
      label: "Declined",
      className:
        "bg-[var(--color-muted)]/10 dark:bg-[var(--color-muted)]/20 text-[var(--color-muted)] border border-[var(--color-muted)]/30 dark:border-[var(--color-muted)]/50",
    },
    expired: {
      label: "Expired",
      className:
        "bg-[var(--color-muted)]/10 dark:bg-[var(--color-muted)]/20 text-[var(--color-muted)] border border-[var(--color-muted)]/30 dark:border-[var(--color-muted)]/50",
    },
    cancelled: {
      label: "Cancelled",
      className:
        "bg-[var(--color-muted)]/10 dark:bg-[var(--color-muted)]/20 text-[var(--color-muted)] border border-[var(--color-muted)]/30 dark:border-[var(--color-muted)]/50",
    },
  };

function truncateId(id: string): string {
  return id.slice(0, 8);
}

export function TradeRequestCard({
  trade,
  currentUserId,
  isCoordinator,
  onRespond,
  onForceOverride,
}: Props) {
  const badge = STATUS_BADGE[trade.status];
  const isRequester = trade.requested_by === currentUserId;
  const isTarget =
    trade.target_user_id === currentUserId || trade.target_user_id === null;
  const canRespond = trade.status === "open" && isTarget && !isRequester;
  const canCancel = trade.status === "open" && isRequester;
  const showForceOverride =
    isCoordinator && trade.status === "open" && !isRequester;

  return (
    <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
          aria-label={`Status: ${badge.label}`}
        >
          {trade.status === "open" && (
            <Clock className="h-3 w-3" aria-hidden="true" />
          )}
          {trade.status === "accepted" && (
            <CheckCircle className="h-3 w-3" aria-hidden="true" />
          )}
          {(trade.status === "declined" ||
            trade.status === "cancelled" ||
            trade.status === "expired") && (
            <XCircle className="h-3 w-3" aria-hidden="true" />
          )}
          {badge.label}
        </span>
        <time
          dateTime={trade.created_at}
          className="text-xs text-[var(--color-muted)]"
        >
          {new Date(trade.created_at).toLocaleDateString()}
        </time>
      </div>

      {/* Meta */}
      <dl className="text-sm space-y-1">
        <div className="flex gap-2">
          <dt className="text-[var(--color-text-secondary)] min-w-[6rem]">
            Requested by:
          </dt>
          <dd className="text-[var(--color-ink)] font-mono text-xs">
            {isRequester ? "you" : truncateId(trade.requested_by)}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-[var(--color-text-secondary)] min-w-[6rem]">
            Target:
          </dt>
          <dd className="text-[var(--color-ink)] font-mono text-xs">
            {trade.target_user_id === null
              ? "Open trade"
              : trade.target_user_id === currentUserId
                ? "you"
                : truncateId(trade.target_user_id)}
          </dd>
        </div>
      </dl>

      {/* Optional message */}
      {trade.message && (
        <blockquote className="border-l-2 border-[var(--color-border)] pl-3 text-sm text-[var(--color-text-secondary)] italic">
          {trade.message}
        </blockquote>
      )}

      {/* Requester: cancel */}
      {canCancel && (
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRespond(trade.id, "decline")}
            className="focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            Cancel request
          </Button>
        </div>
      )}

      {/* Target: accept / decline */}
      {canRespond && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => onRespond(trade.id, "accept")}
            className="focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            <CheckCircle className="h-4 w-4 mr-1" aria-hidden="true" />
            Accept
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRespond(trade.id, "decline")}
            className="focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            <XCircle className="h-4 w-4 mr-1" aria-hidden="true" />
            Decline
          </Button>
        </div>
      )}

      {/* Coordinator: force override */}
      {showForceOverride && onForceOverride && (
        <div className="border-t border-[var(--color-border)] pt-3 mt-1">
          <p className="flex items-center gap-1 text-xs text-[var(--color-warning)] font-medium mb-2">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            Coordinator override
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onForceOverride(trade.id, "accept")}
              className="focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
            >
              Force accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onForceOverride(trade.id, "decline")}
              className="focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
            >
              Force decline
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onForceOverride(trade.id, "cancel")}
              className="focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
