import type { CalendarEvent } from "./ShiftCalendar";
import { formatTimeShortLocale } from "@/lib/format";

type Props = { event: CalendarEvent };

export function ShiftEventCard({ event }: Props) {
  const { title, resource } = event;
  const start = formatTimeShortLocale(resource.start_at);
  const end = formatTimeShortLocale(resource.end_at);
  return (
    <div className="min-w-0 leading-tight">
      <div className="truncate font-semibold">{title}</div>
      <div className="truncate text-[10px] opacity-75">
        {start}–{end}
      </div>
    </div>
  );
}
