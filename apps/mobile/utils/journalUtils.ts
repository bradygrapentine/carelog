export type Mood = 'good' | 'okay' | 'difficult' | 'crisis'
export type ReactionKey = 'heart' | 'thinking_of_you' | 'strong' | 'grateful'

export const MOOD_COLORS: Record<Mood, { bg: string; text: string }> = {
  good:      { bg: '#f0fdf4', text: '#166534' },
  okay:      { bg: '#fefce8', text: '#854d0e' },
  difficult: { bg: '#fff7ed', text: '#9a3412' },
  crisis:    { bg: '#fef2f2', text: '#991b1b' },
}

export const REACTIONS = [
  { key: 'heart' as const,            emoji: '❤️', label: 'Heart' },
  { key: 'thinking_of_you' as const,  emoji: '🤍', label: 'Thinking of you' },
  { key: 'strong' as const,           emoji: '💪', label: 'Strong' },
  { key: 'grateful' as const,         emoji: '🙏', label: 'Grateful' },
] as const

export function formatEntryTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatEntryDateTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  )
}

export function canFlag(role: string | null): boolean {
  return role === 'coordinator'
}
