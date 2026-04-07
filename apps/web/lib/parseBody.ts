import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'

// 64 KB — generous for all current routes; blocks attempts to exhaust server memory.
const MAX_BODY_BYTES = 65_536

export async function parseBody<T>(
  request: NextRequest,
  schema: z.ZodType<T>,
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  // Fast-path: reject oversized payloads via Content-Length before reading the body.
  // The header may be absent on chunked transfers, so this is advisory only.
  const cl = parseInt(request.headers.get('content-length') ?? '0', 10)
  if (!isNaN(cl) && cl > MAX_BODY_BYTES) {
    return { data: null, error: NextResponse.json({ error: 'Payload too large' }, { status: 413 }) }
  }

  // Read as raw text so we can enforce a hard byte limit before JSON.parse.
  let raw: string
  try {
    raw = await request.text()
  } catch {
    return { data: null, error: NextResponse.json({ error: 'Failed to read request body' }, { status: 400 }) }
  }

  if (raw.length > MAX_BODY_BYTES) {
    return { data: null, error: NextResponse.json({ error: 'Payload too large' }, { status: 413 }) }
  }

  // Parse JSON — owning this step gives us a clean 400 instead of a framework 500.
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { data: null, error: NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 }) }
  }

  // Validate shape and types against the Zod schema.
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    return { data: null, error: NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 }) }
  }

  return { data: parsed.data, error: null }
}
