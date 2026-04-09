'use client'

import { useEffect, useState } from 'react'

type Medication = {
  drug_name:    string
  dosage:       string | null
  instructions: string | null
}

type JournalEntry = {
  occurred_at: string
  text:        string | undefined
  mood:        string | undefined
  flagged:     boolean
}

type BriefContent = {
  recipient_name: string
  dob:            string | null
  generated_at:   string
  medications:    Medication[]
  recent_entries: JournalEntry[]
}

type Brief = {
  id:         string
  title:      string
  content:    BriefContent
  includes:   string[]
  created_at: string
}

const moodColors: Record<string, string> = {
  good:      '#dcfce7',
  okay:      '#fef9c3',
  difficult: '#fee2e2',
  crisis:    '#fecdd3',
}

const moodLabels: Record<string, string> = {
  good:      'Good',
  okay:      'Okay',
  difficult: 'Difficult',
  crisis:    'Crisis',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year:  'numeric',
    month: 'long',
    day:   'numeric',
  })
}

function truncate(text: string | undefined, max: number) {
  if (!text) return ''
  return text.length > max ? text.slice(0, max) + '…' : text
}

export default function BriefPage({ params }: { params: Promise<{ shareToken: string }> }) {
  const [brief,    setBrief]    = useState<Brief | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [token,    setToken]    = useState<string | null>(null)

  useEffect(() => {
    params.then(p => setToken(p.shareToken))
  }, [params])

  useEffect(() => {
    if (!token) return
    const url = '/api/brief/' + token
    fetch(url)
      .then(res => {
        if (res.status === 404 || res.status === 410) {
          setError('This care brief is no longer available.')
          setLoading(false)
          return null
        }
        if (!res.ok) {
          setError('Unable to load care brief.')
          setLoading(false)
          return null
        }
        return res.json()
      })
      .then(data => {
        if (data) {
          setBrief(data as Brief)
          setLoading(false)
        }
      })
      .catch(() => {
        setError('Unable to load care brief.')
        setLoading(false)
      })
  }, [token])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #111827', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error || !brief) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: '2rem' }}>
          <p style={{ color: '#6b7280', fontSize: '1rem' }}>{error ?? 'This care brief is no longer available.'}</p>
        </div>
      </div>
    )
  }

  const { content } = brief
  const generatedDate = formatDate(content.generated_at)

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '2rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>{brief.title}</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>Generated on {generatedDate}</p>
          <p style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', marginTop: '0.75rem' }}>{content.recipient_name}</p>
        </div>

        {/* Medications */}
        {brief.includes.includes('medications') && (
          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Medications
            </h2>
            {content.medications.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No active medications recorded.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {content.medications.map((med, i) => (
                  <li key={i} style={{ padding: '0.75rem', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{med.drug_name}</span>
                    {med.dosage && <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>{med.dosage}</span>}
                    {med.instructions && <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>{med.instructions}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Recent journal entries */}
        {brief.includes.includes('journal') && (
          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recent Journal Entries
            </h2>
            {content.recent_entries.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No recent journal entries.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {content.recent_entries.map((entry, i) => {
                  const moodBg = entry.mood ? (moodColors[entry.mood] ?? '#f3f4f6') : undefined
                  const moodLabel = entry.mood ? (moodLabels[entry.mood] ?? entry.mood) : undefined
                  return (
                    <li key={i} style={{ padding: '0.75rem', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                        <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{formatDate(entry.occurred_at)}</span>
                        {moodLabel && (
                          <span style={{ background: moodBg, padding: '0.125rem 0.5rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 500, color: '#374151' }}>
                            {moodLabel}
                          </span>
                        )}
                      </div>
                      {entry.text && (
                        <p style={{ color: '#374151', fontSize: '0.875rem', margin: 0 }}>{truncate(entry.text, 140)}</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', marginTop: '0.5rem' }}>
          <p style={{ color: '#9ca3af', fontSize: '0.75rem', textAlign: 'center', margin: 0 }}>
            This is a point-in-time snapshot generated by Carelog.
          </p>
        </div>
      </div>
    </div>
  )
}
