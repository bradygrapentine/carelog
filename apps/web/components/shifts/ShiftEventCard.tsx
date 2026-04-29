import type { CalendarEvent } from "./ShiftCalendar";
import { formatTimeShortLocale } from "@/lib/format";

type Props = { event: CalendarEvent };

export function ShiftEventCard({ event }: Props) {
  const { title, resource } = event;
  const start = formatTimeShortLocale(resource.start_at);
  const end = formatTimeShortLocale(resource.end_at);
  return (
    <div className="leading-tight">
      <div className="font-semibold truncate">{title}</div>
      <div className="text-[10px] opacity-75">
        {start}–{end}
      </div>
    </div>
  );
}
