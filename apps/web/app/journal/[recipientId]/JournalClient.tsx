'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import type { User } from '@supabase/supabase-js'
import { JournalEntryForm } from './JournalEntryForm'
import { JournalTimeline } from './JournalTimeline'
import { TeamPanel } from './TeamPanel'

interface Props { recipientId: string }
interface OrgInfo { id: string; name: string }
interface Member { id: string; role: string; user_id: string; email: string | null }

export function JournalClient({ recipientId }: Props) {
  const [user,        setUser]        = useState<User | null>(null)
  const [org,         setOrg]         = useState<OrgInfo | null>(null)
  const [events,      setEvents]      = useState<any[]>([])
  const [members,     setMembers]     = useState<Member[]>([])
  const [loading,     setLoading]     = useState(true)
  const [posting,     setPosting]     = useState(false)
  const [showInvite,  setShowInvite]  = useState(false)

  async function loadEvents() {
    const res = await fetch('/api/journal?recipientId=' + recipientId)
    const data = await res.json()
    if (data.events) setEvents(data.events)
  }

  async function loadMembers(orgId: string) {
    const res = await fetch('/api/members?orgId=' + orgId)
    const data = await res.json()
    if (data.members) setMembers(data.members)
  }

  useEffect(() => {
    // Load sequence: user first (auth gate), then org+members+events.
    // We use the browser client (anon key) for auth and RLS-scoped reads.
    // identity_vault is never queried here — recipient names are resolved
    // server-side via the display_names cache when needed.
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/signin'; return }
      setUser(user)

      // Fetch the recipient's org via a Supabase join.
      // RLS ensures this returns null if the user doesn't have access.
      const { data: recipient } = await supabase
        .from('care_recipients')
        .select('org_id, organizations(id, name)')
        .eq('id', recipientId)
        .single()
      if (recipient) {
        const orgData = (recipient as any).organizations
        setOrg(orgData)
        // Load members and events in sequence (both depend on org being set).
        await loadMembers(orgData.id)
      }
      await loadEvents()
      setLoading(false)
    })
  }, [recipientId])

  async function handlePost(text: string, mood: string) {
    if (!user || !org) return
    setPosting(true)
    await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId, orgId: org.id, text, mood, userId: user.id }),
    })
    // Full reload after POST rather than optimistic update. The server is the
    // source of truth for occurred_at and the generated payload shape.
    await loadEvents()
    setPosting(false)
  }

  async function handleInvite(email: string, role: string) {
    if (!user || !org) return
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: org.id, recipientId, role, email, invitedBy: user.id }),
    })
    const data = await res.json()
    if (data.inviteUrl) {
      alert('Invite link — copy and send to ' + email + ':\n\n' + data.inviteUrl)
      setShowInvite(false)
    } else {
      alert('Error: ' + (data.error ?? 'Something went wrong'))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <span className="font-semibold text-gray-900">{org?.name ?? 'Care Journal'}</span>
        </div>
        <span className="text-sm text-gray-500">{user?.email}</span>
      </nav>

      <div className="max-w-2xl mx-auto py-8 px-4">
        <JournalEntryForm onPost={handlePost} posting={posting} />
        <div className="mt-6">
          <TeamPanel
            members={members}
            currentUserId={user?.id ?? ''}
            onInvite={handleInvite}
            showInvite={showInvite}
            onToggleInvite={() => setShowInvite(v => !v)}
          />
        </div>
        <div className="mt-6">
          <JournalTimeline events={events} />
        </div>
      </div>
    </div>
  )
}