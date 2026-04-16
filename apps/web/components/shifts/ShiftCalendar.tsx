"use client";

import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { ShiftEventCard } from "./ShiftEventCard";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale/en-US";

// ─── types ───────────────────────────────────────────────────────────────────

export type Shift = {
  id: string;
  org_id: string;
  recipient_id: string;
  start_at: string;
  end_at: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  assigned_user_id: string | null;
  assigned_display_name: string | null;
};

export type CalendarEvent = {
  title: string;
  start: Date;
  end: Date;
  resource: Shift;
};

// ─── mapper ──────────────────────────────────────────────────────────────────

export function shiftToCalendarEvent(shift: Shift): CalendarEvent {
  return {
    title: shift.assigned_display_name ?? "Unassigned",
    start: new Date(shift.start_at),
    end: new Date(shift.end_at),
    resource: shift,
  };
}

// ─── status → CSS class mapper ──────────────────────────────────────────────

export function getShiftEventClass(
  statusOrNull: Shift["status"] | null,
): string {
  if (!statusOrNull) return "shift-event--unassigned";
  const map: Record<Shift["status"], string> = {
    scheduled: "shift-event--scheduled",
    in_progress: "shift-event--in-progress",
    completed: "shift-event--completed",
    cancelled: "shift-event--cancelled",
  };
  return map[statusOrNull];
}

function eventPropGetter(event: CalendarEvent) {
  const cls = event.resource.assigned_user_id
    ? getShiftEventClass(event.resource.status)
    : "shift-event--unassigned";
  return { className: cls };
}

// ─── localizer ───────────────────────────────────────────────────────────────

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { "en-US": enUS },
});

// ─── component (shell — filled in Task 5) ────────────────────────────────────

type Props = {
  shifts: Shift[];
  onSelectEvent?: (shift: Shift) => void;
  onSelectSlot?: (start: Date, end: Date) => void;
};

export function ShiftCalendar({ shifts, onSelectEvent, onSelectSlot }: Props) {
  const events: CalendarEvent[] = shifts.map(shiftToCalendarEvent);
  return (
    <div className="h-[600px]">
      <Calendar
        localizer={localizer}
        events={events}
        defaultView="week"
        views={["day", "week", "month"]}
        onSelectEvent={(e) => onSelectEvent?.(e.resource)}
        selectable
        onSelectSlot={(s) => onSelectSlot?.(s.start, s.end)}
        eventPropGetter={eventPropGetter}
        components={{ event: ShiftEventCard }}
      />
    </div>
  );
}
