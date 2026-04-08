'use client'

import { useState } from 'react'

interface Member { id: string; role: string; user_id: string; display_name: string | null; email: string | null }

interface Props {
  readonly members:        Member[]
  readonly currentUserId:  string
  readonly canInvite:      boolean
  readonly onInvite:       (email: string, role: string) => Promise<void>
  readonly showInvite:     boolean
  readonly onToggleInvite: () => void
}

const ROLE_COLORS: Record<string, string> = {
  coordinator: 'bg-purple-100 text-purple-800',
  caregiver:   'bg-blue-100 text-blue-800',
  supporter:   'bg-green-100 text-green-800',
  aide:        'bg-orange-100 text-orange-800',
}

const ROLE_LABELS: Record<string, string> = {
  coordinator: 'Coordinator',
  caregiver:   'Caregiver',
  supporter:   'Supporter',
  aide:        'Aide',
}

export function TeamPanel({ members, currentUserId, canInvite, onInvite, showInvite, onToggleInvite }: Props) {
  const [email,   setEmail]   = useState('')
  const [role,    setRole]    = useState('caregiver')
  const [sending, setSending] = useState(false)

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    await onInvite(email.trim(), role)
    setEmail('')
    setRole('caregiver')
    setSending(false)
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-50">
        <h3 className="text-sm font-medium text-gray-900">
          {'Care team'}
          <span className="ml-2 text-xs text-gray-400 font-normal">{members.length}{' members'}</span>
        </h3>
        {canInvite && (
          <button
            onClick={onToggleInvite}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:border-gray-300 transition-colors"
          >
            {showInvite ? 'Cancel' : 'Invite someone'}
          </button>
        )}
      </div>

      {showInvite && (
        <form onSubmit={handleInvite} className="px-4 py-3 border-b border-gray-50 bg-gray-50">
          <p className="text-xs text-gray-500 mb-3">They will receive an invite link to join this care team.</p>
          <div className="flex gap-2 mb-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="caregiver">Caregiver</option>
              <option value="coordinator">Coordinator</option>
              <option value="supporter">Supporter</option>
              <option value="aide">Aide</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={sending || !email.trim()}
            className="w-full py-1.5 px-3 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {sending ? 'Sending...' : 'Send invite'}
          </button>
        </form>
      )}

      <div className="divide-y divide-gray-50">
        {members.map(member => (
          <div key={member.id} className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-xs font-medium text-gray-600">
                  {(member.display_name?.[0] ?? '?').toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-900">
                  {member.display_name ?? 'Team member'}
                </span>
                {member.user_id === currentUserId && (
                  <span className="ml-2 text-xs text-gray-400">you</span>
                )}
              </div>
            </div>
            <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (ROLE_COLORS[member.role] ?? 'bg-gray-100 text-gray-600')}>
              {ROLE_LABELS[member.role] ?? member.role}
            </span>
          </div>
        ))}
        {members.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-gray-400">No team members yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}