'use client'

import { useState } from 'react'

const MOODS = [
  { value: 'good',      label: 'Good',      color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'okay',      label: 'Okay',      color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { value: 'difficult', label: 'Difficult', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'crisis',    label: 'Crisis',    color: 'bg-red-100 text-red-800 border-red-200' },
]

interface Props {
  onPost:  (text: string, mood: string) => Promise<void>
  posting: boolean
}

export function JournalEntryForm({ onPost, posting }: Props) {
  const [text,     setText]     = useState('')
  const [mood,     setMood]     = useState('')
  const [expanded, setExpanded] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    await onPost(text.trim(), mood)
    setText('')
    setMood('')
    setExpanded(false)
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <form onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); if (!expanded) setExpanded(true) }}
          onFocus={() => setExpanded(true)}
          placeholder="Share how today went..."
          rows={expanded ? 4 : 2}
          className="w-full px-4 py-3 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none"
        />

        {expanded && (
          <div className="px-4 pb-4">
            <p className="text-xs text-gray-400 mb-2">How is today going?</p>
            <div className="flex gap-2 flex-wrap mb-4">
              {MOODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMood(mood === m.value ? '' : m.value)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    mood === m.value
                      ? m.color
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setExpanded(false); setText(''); setMood('') }}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={posting || !text.trim()}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {posting ? 'Sharing...' : 'Share update'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}