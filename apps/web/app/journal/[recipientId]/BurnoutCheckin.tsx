'use client'

import { useState } from 'react'
import { trpc } from '../../../lib/trpc'

interface Props {
  orgId:           string
  currentUserRole: string
  currentUserId:   string
}

function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function currentWeekStamp(): string {
  const d    = new Date()
  const year = d.getFullYear()
  const week = String(getISOWeek(d)).padStart(2, '0')
  return year + '-W' + week
}

export function BurnoutCheckin({ orgId, currentUserRole, currentUserId }: Props) {
  const [sleepScore,   setSleepScore]   = useState(3)
  const [stressScore,  setStressScore]  = useState(3)
  const [supportScore, setSupportScore] = useState(3)
  const [notes,        setNotes]        = useState('')
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  // Hooks must be called unconditionally — role guard is applied after
  const checkInMutation = trpc.burnout.checkIn.useMutation({
    onSuccess: () => {
      setSaved(true)
      setError(null)
    },
    onError: () => setError('Something went wrong. Please try again.'),
  })

  // Only coordinators and caregivers fill out check-ins
  if (currentUserRole === 'supporter' || currentUserRole === 'aide') return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    checkInMutation.mutate({
      org_id:        orgId,
      user_id:       currentUserId,
      sleep_score:   sleepScore,
      stress_score:  stressScore,
      support_score: supportScore,
      notes:         notes.trim() || undefined,
      week_stamp:    currentWeekStamp(),
    })
  }

  const scoreLabels: Record<number, string> = { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' }

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50">
        <p className="text-sm font-medium text-gray-700">How are you doing this week?</p>
        <p className="text-xs text-gray-400 mt-0.5">Your answers are private and help us look out for you.</p>
      </div>

      <div className="px-4 py-3">
        {saved ? (
          <p className="text-sm text-green-600">Check-in saved. We&apos;ll remind you next week.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="burnout-sleep" className="block text-xs text-gray-500 mb-1">
                Sleep quality — {scoreLabels[sleepScore]}
                <span className="text-gray-300 ml-2">(1 = very poor, 5 = great)</span>
              </label>
              <input
                id="burnout-sleep"
                type="range"
                min={1}
                max={5}
                value={sleepScore}
                onChange={e => setSleepScore(parseInt(e.target.value, 10))}
                className="w-full accent-gray-900"
              />
            </div>

            <div>
              <label htmlFor="burnout-stress" className="block text-xs text-gray-500 mb-1">
                Stress level — {scoreLabels[stressScore]}
                <span className="text-gray-300 ml-2">(1 = none, 5 = overwhelming)</span>
              </label>
              <input
                id="burnout-stress"
                type="range"
                min={1}
                max={5}
                value={stressScore}
                onChange={e => setStressScore(parseInt(e.target.value, 10))}
                className="w-full accent-gray-900"
              />
            </div>

            <div>
              <label htmlFor="burnout-support" className="block text-xs text-gray-500 mb-1">
                Support from others — {scoreLabels[supportScore]}
                <span className="text-gray-300 ml-2">(1 = none, 5 = well supported)</span>
              </label>
              <input
                id="burnout-support"
                type="range"
                min={1}
                max={5}
                value={supportScore}
                onChange={e => setSupportScore(parseInt(e.target.value, 10))}
                className="w-full accent-gray-900"
              />
            </div>

            <div>
              <label htmlFor="burnout-notes" className="block text-xs text-gray-500 mb-1">Anything you want to add? (optional)</label>
              <textarea
                id="burnout-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                maxLength={500}
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400 resize-none"
                placeholder="How are you really doing?"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={checkInMutation.isPending}
              className="w-full px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {checkInMutation.isPending ? 'Saving...' : 'Save check-in'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
