'use client'

import { useState } from 'react'
import { trpc } from '../../../lib/trpc'

interface Member {
  id:           string
  role:         string
  user_id:      string
  display_name: string | null
  email:        string | null
}

interface Props {
  orgId:           string
  recipientId:     string
  members:         Member[]
  currentUserId:   string
  currentUserRole: string
}

function getWeekRange(offset: number): { from: string; to: string } {
  const now = new Date()
  // Monday of current week
  const day = now.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday + offset * 7))
  // Sunday end = Monday + 14 days (two-week window)
  const sundayEnd = new Date(monday.getTime() + 14 * 24 * 60 * 60 * 1000 - 1)
  return {
    from: monday.toISOString(),
    to:   sundayEnd.toISOString(),
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function groupByDay(shifts: Array<{ start_at: string }>): Map<string, typeof shifts> {
  const map = new Map<string, typeof shifts>()
  for (const shift of shifts) {
    const key = new Date(shift.start_at).toLocaleDateString([], {
      weekday: 'long',
      month:   'short',
      day:     'numeric',
    })
    const group = map.get(key) ?? []
    group.push(shift)
    map.set(key, group)
  }
  return map
}

const STATUS_STYLES: Record<string, string> = {
  scheduled:   'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-gray-100 text-gray-400 line-through',
}

export function ShiftList({ orgId, recipientId, members, currentUserId, currentUserRole }: Props) {
  const [weekOffset, setWeekOffset] = useState(0)
  const { from, to } = getWeekRange(weekOffset)

  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.shifts.list.useQuery({
    org_id:       orgId,
    recipient_id: recipientId,
    from,
    to,
  })
  const cancelMutation = trpc.shifts.cancel.useMutation({
    onSuccess: () => utils.shifts.list.invalidate(),
  })

  const shifts = data?.rows ?? []
  const grouped = groupByDay(shifts)

  function lookupName(userId: string): string {
    const m = members.find(mem => mem.user_id === userId)
    return m?.display_name ?? m?.email ?? 'Unknown'
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-50">
        <p className="text-sm font-medium text-gray-700">Shifts</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset(w => w - 1)}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
            aria-label="Previous week"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(w => w + 1)}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
            aria-label="Next week"
          >
            Next
          </button>
        </div>
      </div>

      <div className="px-4 py-3">
        {isLoading && (
          <p className="text-sm text-gray-400">Loading shifts...</p>
        )}

        {!isLoading && shifts.length === 0 && (
          <p className="text-sm text-gray-400">No shifts scheduled this week.</p>
        )}

        {!isLoading && shifts.length > 0 && (
          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([dayLabel, dayShifts]) => (
              <div key={dayLabel}>
                <p className="text-xs font-medium text-gray-500 mb-2">{dayLabel}</p>
                <div className="space-y-2">
                  {dayShifts.map((shift: Record<string, unknown>) => {
                    const shiftId = shift.id as string
                    const assigneeId = shift.assignee_user_id as string
                    const status = shift.status as string
                    const startAt = shift.start_at as string
                    const endAt = shift.end_at as string
                    const notes = shift.notes as string | undefined
                    const isOwn = assigneeId === currentUserId
                    const isCancelled = status === 'cancelled'
                    const canCancel = currentUserRole === 'coordinator' && !isCancelled
                    const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.scheduled
                    const timeRange = formatTime(startAt) + ' - ' + formatTime(endAt)
                    const assigneeName = lookupName(assigneeId)

                    return (
                      <div key={shiftId} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-800">{timeRange}</span>
                            <span className={'text-xs px-2 py-0.5 rounded-full ' + statusStyle}>{status.replace('_', ' ')}</span>
                            {isOwn && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Your shift</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5">{assigneeName}</p>
                          {notes && (
                            <p className="text-xs text-gray-400 mt-0.5">{notes}</p>
                          )}
                        </div>
                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => cancelMutation.mutate({ id: shiftId, org_id: orgId })}
                            disabled={cancelMutation.isPending}
                            className="text-xs text-red-500 hover:text-red-700 ml-3 shrink-0"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
