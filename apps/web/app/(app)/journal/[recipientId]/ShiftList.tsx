"use client";

import { useState, useMemo } from "react";
import { trpc } from "../../../../lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ShiftCalendar, type Shift } from "@/components/shifts/ShiftCalendar";
import { ShiftPopover } from "@/components/shifts/ShiftPopover";
import { ShiftForm } from "./ShiftForm";

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

function getRangeForDate(centerDate: Date): { from: string; to: string } {
  const from = new Date(
    Date.UTC(centerDate.getUTCFullYear(), centerDate.getUTCMonth() - 1, 1),
  );
  const to = new Date(
    Date.UTC(
      centerDate.getUTCFullYear(),
      centerDate.getUTCMonth() + 2,
      0,
      23,
      59,
      59,
    ),
  );
  return { from: from.toISOString(), to: to.toISOString() };
}

export function ShiftList({
  orgId,
  recipientId,
  members,
  currentUserId: _currentUserId,
  currentUserRole,
}: Props) {
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());
  // Memoize date range to avoid recomputing ISO strings on every render.
  const { from, to } = useMemo(
    () => getRangeForDate(calendarDate),
    // Use numeric timestamp as dep — Date objects are new references each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calendarDate.getTime()],
  );

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
            shifts={shifts}
            onSelectEvent={(shift) => setSelectedShift(shift)}
            onSelectSlot={() => {
              /* ShiftForm handles creation */
            }}
            onNavigate={(date) => setCalendarDate(date)}
          />
        </CardContent>
      </Card>

      <ShiftPopover
        shift={selectedShift}
        isOpen={!!selectedShift}
        onClose={() => setSelectedShift(null)}
        isCoordinator={isCoordinator}
        orgId={orgId}
        recipientId={recipientId}
        onEdit={(shift) => {
          setEditingShift(shift);
          setSelectedShift(null);
        }}
        onCancel={handleCancel}
        onCompleted={() => {
          utils.shifts.list.invalidate();
          setSelectedShift(null);
        }}
      />

      {editingShift && (
        <div className="mt-4">
          <ShiftForm
            members={members}
            recipientId={recipientId}
            orgId={orgId}
            shiftId={editingShift.id}
            initialValues={{
              date: editingShift.start_at.slice(0, 10),
              startTime: editingShift.start_at.slice(11, 16),
              endTime: editingShift.end_at.slice(11, 16),
              assigneeId: editingShift.assignee_user_id ?? "",
              notes: "",
            }}
            onSuccess={() => setEditingShift(null)}
          />
        </div>
      )}
    </>
  );
}
