import { Resend } from 'resend'

if (typeof window !== 'undefined') {
  throw new Error('resend.server.ts must not be imported in client components')
}

// null when RESEND_API_KEY is not set (local dev without Resend credentials).
// Callers must guard: if (!resend) { skip or log }
export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null
