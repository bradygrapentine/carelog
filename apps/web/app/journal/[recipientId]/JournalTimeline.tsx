'use client'

import { useEffect, useState } from 'react'

const MOOD_STYLES: Record<string, string> = {
  good:      'bg-green-50 text-green-700',
  okay:      'bg-yellow-50 text-yellow-700',
  difficult: 'bg-orange-50 text-orange-700',
  crisis:    'bg-red-50 text-red-700',
}

const REACTIONS = [
  { key: 'heart',           title: 'Heart',          emoji: '❤️' },
  { key: 'thinking_of_you', title: 'Thinking of you', emoji: '🤍' },
  { key: 'strong',          title: 'Strong',          emoji: '💪' },
  { key: 'grateful',        title: 'Grateful',        emoji: '🙏' },
] as const

type ReactionKey = typeof REACTIONS[number]['key']

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

function useReactions(eventId: string, userId: string | null) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [myReaction, setMyReaction] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    const url = '/api/journal/' + eventId + '/reactions?userId=' + userId
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.counts) setCounts(data.counts)
        setMyReaction(data.myReaction ?? null)
      })
  }, [eventId, userId])

  async function toggle(reaction: ReactionKey) {
    if (!userId) return

    const prevCounts = { ...counts }
    const prevMyReaction = myReaction
    const isToggleOff = myReaction === reaction

    // Optimistic update
    const next = { ...counts }
    if (isToggleOff) {
      next[reaction] = Math.max(0, (next[reaction] ?? 0) - 1)
      setCounts(next)
      setMyReaction(null)
    } else {
      if (myReaction) {
        next[myReaction] = Math.max(0, (next[myReaction] ?? 0) - 1)
      }
      next[reaction] = (next[reaction] ?? 0) + 1
      setCounts(next)
      setMyReaction(reaction)
    }

    try {
      const url = '/api/journal/' + eventId + '/reactions'
      if (isToggleOff) {
        await fetch(url, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })
      } else {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, reaction }),
        })
      }
    } catch {
      // Rollback on network error
      setCounts(prevCounts)
      setMyReaction(prevMyReaction)
    }
  }

  return { counts, myReaction, toggle }
}

interface JournalEvent {
  id: string
  event_type: string
  entry_kind: string
  occurred_at: string
  flagged: boolean
  payload?: { text?: string; mood?: string }
}

interface CardProps {
  event: JournalEvent
  currentUserId: string | null
  canFlag: boolean
  onFlag: (eventId: string, flagged: boolean) => void
}

function JournalCard({ event, currentUserId, canFlag, onFlag }: CardProps) {
  const payload = event.payload ?? {}
  const { counts, myReaction, toggle } = useReactions(event.id, currentUserId)

  const moodClass = 'shrink-0 text-xs px-2 py-1 rounded-full capitalize ' +
    (MOOD_STYLES[payload.mood ?? ''] ?? 'bg-gray-100 text-gray-600')

  const flagBtnClass = 'text-xs px-2 py-0.5 rounded-full transition-colors ' +
    (event.flagged ? 'text-blue-600 hover:text-blue-800' : 'text-gray-400 hover:text-blue-600')

  return (
    <div data-testid="journal-entry" className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-sm text-gray-900 leading-relaxed flex-1">
          {payload.text}
        </p>
        {payload.mood && (
          <span className={moodClass}>
            {payload.mood}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-400">
          {formatTime(event.occurred_at)}
        </p>
        <div className="flex items-center gap-2">
          {event.flagged && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              Flagged for doctor
            </span>
          )}
          {canFlag && (
            <button
              onClick={() => onFlag(event.id, !event.flagged)}
              className={flagBtnClass}
            >
              {event.flagged ? 'Unflag' : 'Flag for doctor'}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 pt-2 border-t border-gray-50">
        {REACTIONS.map(r => {
          const count = counts[r.key] ?? 0
          const isActive = myReaction === r.key
          const btnClass = 'flex items-center gap-1 text-sm px-2 py-0.5 rounded-full transition-colors ' +
            (isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600')
          return (
            <button
              key={r.key}
              title={r.title}
              onClick={() => toggle(r.key)}
              className={btnClass}
            >
              {r.emoji}
              {count > 0 && <span>{count}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface Props {
  events: JournalEvent[]
  currentUserId: string | null
  canFlag: boolean
  onFlag: (eventId: string, flagged: boolean) => void
}

export function JournalTimeline({ events, currentUserId, canFlag, onFlag }: Props) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-sm">
          {canFlag
            ? 'No entries yet. Share how today is going above.'
            : 'No entries have been shared yet.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {events.map(event => {
        const isHuman = event.entry_kind === 'human'

        if (isHuman && event.event_type === 'journal') {
          return (
            <JournalCard
              key={event.id}
              event={event}
              currentUserId={currentUserId}
              canFlag={canFlag}
              onFlag={onFlag}
            />
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
