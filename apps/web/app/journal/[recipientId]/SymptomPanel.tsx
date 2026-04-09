'use client'

import { useState } from 'react'
import { trpc } from '../../../lib/trpc'

interface Props {
  orgId:           string
  recipientId:     string
  currentUserRole: string
}

type SymptomRow = {
  id:          string
  pain_level:  number | null
  mood:        string | null
  appetite:    string | null
  mobility:    string | null
  notes:       string | null
  recorded_at: string
}

const moodLabels: Record<string, string> = {
  good: 'Good', okay: 'Okay', difficult: 'Difficult', crisis: 'Crisis',
}

const moodColors: Record<string, string> = {
  good:      'bg-green-100 text-green-700',
  okay:      'bg-blue-100 text-blue-700',
  difficult: 'bg-amber-100 text-amber-700',
  crisis:    'bg-red-100 text-red-700',
}

export function SymptomPanel({ orgId, recipientId, currentUserRole }: Props) {
  const [expanded,   setExpanded]   = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const [painLevel,  setPainLevel]  = useState(5)
  const [mood,       setMood]       = useState<'good'|'okay'|'difficult'|'crisis'|''>('')
  const [appetite,   setAppetite]   = useState<'normal'|'reduced'|'poor'|'none'|''>('')
  const [mobility,   setMobility]   = useState<'normal'|'limited'|'assisted'|'bedbound'|''>('')
  const [notes,      setNotes]      = useState('')
  const [error,      setError]      = useState<string | null>(null)

  const canLog = currentUserRole === 'coordinator' || currentUserRole === 'caregiver'
  const utils  = trpc.useUtils()

  const { data, isLoading } = trpc.symptoms.list.useQuery(
    { org_id: orgId, recipient_id: recipientId },
    { enabled: expanded }
  )

  const logMutation = trpc.symptoms.log.useMutation({
    onSuccess: () => {
      utils.symptoms.list.invalidate()
      setShowForm(false)
      setPainLevel(5)
      setMood('')
      setAppetite('')
      setMobility('')
      setNotes('')
      setError(null)
    },
    onError: () => setError('Something went wrong. Please try again.'),
  })

  const readings = (data ?? []).slice(0, 7) as SymptomRow[]

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    logMutation.mutate({
      org_id:      orgId,
      recipient_id: recipientId,
      pain_level:  painLevel,
      mood:        mood     || undefined,
      appetite:    appetite || undefined,
      mobility:    mobility || undefined,
      notes:       notes.trim() || undefined,
    })
  }

  if (!expanded) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors w-full text-left"
        >
          Symptom readings
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-50">
        <p className="text-sm font-medium text-gray-700">Symptom readings</p>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Collapse
        </button>
      </div>

      <div className="px-4 py-3">
        {isLoading && <p className="text-sm text-gray-400">Loading...</p>}

        {!isLoading && readings.length === 0 && (
          <p className="text-sm text-gray-400 mb-3">No readings recorded yet.</p>
        )}

        {readings.length > 0 && (
          <div className="space-y-2 mb-4">
            {readings.map(r => {
              const dateStr = new Date(r.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              const moodCls = r.mood ? (moodColors[r.mood] ?? 'bg-gray-100 text-gray-600') : ''
              return (
                <div key={r.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-400 w-16 shrink-0">{dateStr}</span>
                  {r.pain_level !== null && (
                    <span className="text-xs font-medium text-gray-700 shrink-0">
                      Pain: {r.pain_level}/10
                    </span>
                  )}
                  {r.mood && (
                    <span className={'text-xs px-2 py-0.5 rounded-full shrink-0 ' + moodCls}>
                      {moodLabels[r.mood] ?? r.mood}
                    </span>
                  )}
                  {r.notes && (
                    <span className="text-xs text-gray-400 truncate">{r.notes}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {canLog && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            + Log reading
          </button>
        )}

        {canLog && showForm && (
          <form onSubmit={handleSubmit} className="mt-2 space-y-4">
            <div>
              <label htmlFor="symptom-pain" className="block text-xs text-gray-500 mb-1">
                Pain level: {painLevel}/10
              </label>
              <input
                id="symptom-pain"
                type="range"
                min={0}
                max={10}
                value={painLevel}
                onChange={e => setPainLevel(parseInt(e.target.value, 10))}
                className="w-full accent-gray-900"
              />
              <div className="flex justify-between text-xs text-gray-300 mt-0.5">
                <span>0 — none</span>
                <span>10 — severe</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="symptom-mood" className="block text-xs text-gray-500 mb-1">Mood</label>
                <select
                  id="symptom-mood"
                  value={mood}
                  onChange={e => setMood(e.target.value as 'good'|'okay'|'difficult'|'crisis'|'')}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
                >
                  <option value="">—</option>
                  <option value="good">Good</option>
                  <option value="okay">Okay</option>
                  <option value="difficult">Difficult</option>
                  <option value="crisis">Crisis</option>
                </select>
              </div>
              <div>
                <label htmlFor="symptom-appetite" className="block text-xs text-gray-500 mb-1">Appetite</label>
                <select
                  id="symptom-appetite"
                  value={appetite}
                  onChange={e => setAppetite(e.target.value as 'normal'|'reduced'|'poor'|'none'|'')}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
                >
                  <option value="">—</option>
                  <option value="normal">Normal</option>
                  <option value="reduced">Reduced</option>
                  <option value="poor">Poor</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div>
                <label htmlFor="symptom-mobility" className="block text-xs text-gray-500 mb-1">Mobility</label>
                <select
                  id="symptom-mobility"
                  value={mobility}
                  onChange={e => setMobility(e.target.value as 'normal'|'limited'|'assisted'|'bedbound'|'')}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
                >
                  <option value="">—</option>
                  <option value="normal">Normal</option>
                  <option value="limited">Limited</option>
                  <option value="assisted">Assisted</option>
                  <option value="bedbound">Bedbound</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="symptom-notes" className="block text-xs text-gray-500 mb-1">Notes</label>
              <textarea
                id="symptom-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                maxLength={1000}
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400 resize-none"
                placeholder="Any additional observations..."
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(null) }}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={logMutation.isPending}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {logMutation.isPending ? 'Saving...' : 'Save reading'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
