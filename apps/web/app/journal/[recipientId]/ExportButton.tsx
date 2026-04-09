'use client'

import { useState } from 'react'
import { authenticatedFetch } from '../../../lib/authenticatedFetch'

type Props = {
  orgId:           string
  recipientId:     string
  currentUserRole: string
}

type Format = 'json' | 'pdf'

export function ExportButton({ orgId, recipientId, currentUserRole }: Props) {
  const [format,   setFormat]   = useState<Format>('json')
  const [since,    setSince]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  // Server enforces coordinator-only; hide component for other roles
  if (currentUserRole !== 'coordinator') return null

  async function handleDownload(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const body: Record<string, string> = { orgId, recipientId, format }
    if (since) body.since = new Date(since).toISOString()

    const res = await authenticatedFetch('/api/export', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })

    if (!res.ok) {
      setError('Export failed. Please try again.')
      setLoading(false)
      return
    }

    try {
      const blob      = await res.blob()
      const url       = URL.createObjectURL(blob)
      const a         = document.createElement('a')
      a.href          = url
      a.download      = format === 'json' ? 'care-history.json' : 'care-history.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setError('Export failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-4 py-3">
      <p className="text-sm font-medium text-gray-700 mb-3">Export full history</p>
      <form onSubmit={handleDownload} className="space-y-3">

        {/* Format */}
        <fieldset>
          <legend className="text-xs font-medium text-gray-600 mb-1.5">Format</legend>
          <div className="flex gap-2">
            {(['json', 'pdf'] as Format[]).map(f => {
              const isSelected = format === f
              const cls = 'px-3 py-1.5 text-xs font-medium rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 ' +
                (isSelected ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300')
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={cls}
                  aria-pressed={isSelected}
                >
                  {f.toUpperCase()}
                </button>
              )
            })}
          </div>
        </fieldset>

        {/* Date range */}
        <div>
          <label htmlFor="export-since" className="block text-xs font-medium text-gray-600 mb-1">
            From date <span className="font-normal text-gray-400">(optional — exports all history if empty)</span>
          </label>
          <input
            id="export-since"
            type="date"
            value={since}
            onChange={e => setSince(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent"
          />
        </div>

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Preparing...' : 'Download export'}
        </button>
      </form>
    </div>
  )
}
