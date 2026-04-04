'use client'

import { useState } from 'react'

const PROMPTS = [
  'How did they seem today?',
  'Anything the doctor should know?',
  'What was hard today?',
  'Was there a moment of connection?',
  'Any changes in sleep or appetite?',
  'What are you noticing lately?',
  'How are you holding up?',
  'Anything that felt different today?',
  'What went well today?',
  'Any concerns for the next appointment?',
  'How did medications go today?',
  'Any visitors or calls that helped?',
]

function pickPrompts(n: number) {
  const shuffled = [...PROMPTS].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

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
  const [prompts,  setPrompts]  = useState<string[]>([])

  function expand() {
    if (!expanded) {
      setExpanded(true)
      setPrompts(pickPrompts(3))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    await onPost(text.trim(), mood)
    setText('')
    setMood('')
    setExpanded(false)
    setPrompts([])
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <form onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); expand() }}
          onFocus={expand}
          placeholder="Share how today went..."
          rows={expanded ? 4 : 2}
          className="w-full px-4 py-3 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none"
        />

        {expanded && (
          <div className="px-4 pb-4">
            {!text && (
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-2">Need a starting point?</p>
                <div className="flex flex-wrap gap-2">
                  {prompts.map(prompt => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setText(prompt + ' ')}
                      className="text-xs px-3 py-1 rounded-full border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
                onClick={() => { setExpanded(false); setText(''); setMood(''); setPrompts([]) }}
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