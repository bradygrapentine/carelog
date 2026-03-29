'use client'

const MOOD_STYLES: Record<string, string> = {
  good:      'bg-green-50 text-green-700',
  okay:      'bg-yellow-50 text-yellow-700',
  difficult: 'bg-orange-50 text-orange-700',
  crisis:    'bg-red-50 text-red-700',
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (diffDays === 1) {
    return 'Yesterday ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
}

interface Props {
  events: any[]
}

export function JournalTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-sm">
          No entries yet. Share how today is going above.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {events.map(event => {
        const isHuman = event.entry_kind === 'human'
        const payload = event.payload ?? {}

        if (isHuman && event.event_type === 'journal') {
          return (
            <div key={event.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="text-sm text-gray-900 leading-relaxed flex-1">
                  {payload.text}
                </p>
                {payload.mood && (
                  <span className={`shrink-0 text-xs px-2 py-1 rounded-full capitalize ${MOOD_STYLES[payload.mood] ?? 'bg-gray-100 text-gray-600'}`}>
                    {payload.mood}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {formatTime(event.occurred_at)}
                </p>
                {event.flagged && (
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    Flagged for doctor
                  </span>
                )}
              </div>
            </div>
          )
        }

        // System events — compact display
        return (
          <div key={event.id} className="flex items-center gap-3 py-2 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
            <p className="text-xs text-gray-400 flex-1">
              {event.event_type} logged
            </p>
            <p className="text-xs text-gray-400">
              {formatTime(event.occurred_at)}
            </p>
          </div>
        )
      })}
    </div>
  )
}