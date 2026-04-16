import type { CalendarEvent } from "./ShiftCalendar";

type Props = { event: CalendarEvent };

export function ShiftEventCard({ event }: Props) {
  const { title, resource } = event;
  const start = new Date(resource.start_at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const end = new Date(resource.end_at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <div className="leading-tight">
      <div className="font-semibold truncate">{title}</div>
      <div className="text-[10px] opacity-75">
        {start}–{end}
      </div>
    </div>
  );
}
