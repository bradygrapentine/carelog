"use client";

import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";

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

// ─── localizer ───────────────────────────────────────────────────────────────

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
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
      />
    </div>
  );
}
