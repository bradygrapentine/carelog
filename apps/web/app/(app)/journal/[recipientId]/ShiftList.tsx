"use client";

import { useState } from "react";
import { trpc } from "../../../../lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ShiftCalendar, type Shift } from "@/components/shifts/ShiftCalendar";
import { ShiftPopover } from "@/components/shifts/ShiftPopover";

type Member = {
  id: string;
  role: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
};

type Props = {
  orgId: string;
  recipientId: string;
  members: Member[];
  currentUserId: string;
  currentUserRole: string;
};

function getMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0, 23, 59, 59),
  );
  return { from: from.toISOString(), to: to.toISOString() };
}

export function ShiftList({ orgId, recipientId, currentUserRole }: Props) {
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const { from, to } = getMonthRange();

  const { data: shifts = [] } = trpc.shifts.list.useQuery({
    org_id: orgId,
    recipient_id: recipientId,
    from,
    to,
  });

  const cancelMutation = trpc.shifts.cancel.useMutation();
  const utils = trpc.useUtils();

  function handleCancel(shiftId: string) {
    cancelMutation.mutate(
      { id: shiftId, org_id: orgId },
      { onSuccess: () => utils.shifts.list.invalidate() },
    );
    setSelectedShift(null);
  }

  const isCoordinator = currentUserRole === "coordinator";

  return (
    <>
      <Card className="shadow-sm gap-2">
        <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
          <CardTitle className="text-sm">Shift Schedule</CardTitle>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          <ShiftCalendar
            shifts={shifts as Shift[]}
            onSelectEvent={(shift) => setSelectedShift(shift)}
            onSelectSlot={() => {
              /* ShiftForm handles creation */
            }}
          />
        </CardContent>
      </Card>

      <ShiftPopover
        shift={selectedShift}
        isOpen={!!selectedShift}
        onClose={() => setSelectedShift(null)}
        isCoordinator={isCoordinator}
        onEdit={() => {
          /* TODO: open ShiftForm in edit mode */
        }}
        onCancel={handleCancel}
      />
    </>
  );
}
