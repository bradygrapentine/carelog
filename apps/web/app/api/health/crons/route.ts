import { NextResponse } from 'next/server'

// Simple health endpoint — returns the list of registered cron functions
// so oncall can verify the functions are registered.
// Last-run timestamps require Inngest's event store (not available without Inngest Cloud).
export async function GET() {
  return NextResponse.json({
    crons: [
      { id: 'weekly-digest', schedule: 'TZ=UTC 0 8 * * 1' },
      { id: 'refill-alert', schedule: 'TZ=UTC 0 7 * * *' },
      { id: 'burnout-alert', schedule: 'TZ=UTC 0 8 * * 1' },
      { id: 'gap-detector', schedule: 'TZ=UTC 0 6 * * *' },
      { id: 'shift-trade-expiry', schedule: '*/15 * * * *' },
      { id: 'journal-flag-alert', schedule: 'TZ=UTC 0 8 * * *' },
    ],
    status: 'ok',
  })
}
