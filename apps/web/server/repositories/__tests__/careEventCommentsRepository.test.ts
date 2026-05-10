import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listComments,
  insertComment,
  editComment,
  softDeleteComment,
  getFanoutTargets,
  getEventOrgId,
} from '../careEventCommentsRepository'

// ---------------------------------------------------------------------------
// Mock supabaseAdmin (service-role client used by getFanoutTargets / getEventOrgId)
// ---------------------------------------------------------------------------

const mockAdminFrom = vi.fn()

vi.mock('../../supabaseAdmin.server', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockAdminFrom(...args) },
}))

// ---------------------------------------------------------------------------
// Chain-builder helpers
// ---------------------------------------------------------------------------

type MockResult = { data: unknown; error: { message: string } | null }

/** SELECT chain: .select().eq().is().order() → resolves */
function makeListChain(result: MockResult) {
  const chain: Record<string, unknown> = {}
  const resolved = Promise.resolve(result)
  chain.select = () => chain
  chain.eq     = () => chain
  chain.is     = () => chain
  chain.order  = vi.fn().mockResolvedValue(result)
  return chain
}

/** INSERT chain: .insert().select().single() → resolves */
function makeInsertChain(result: MockResult) {
  const chain: Record<string, unknown> = {}
  chain.insert = () => chain
  chain.select = () => chain
  chain.single = vi.fn().mockResolvedValue(result)
  return chain
}

/** UPDATE chain: .update().eq().select().single() → resolves */
function makeUpdateSelectChain(result: MockResult) {
  const chain: Record<string, unknown> = {}
  chain.update = () => chain
  chain.eq     = () => chain
  chain.select = () => chain
  chain.single = vi.fn().mockResolvedValue(result)
  return chain
}

/** UPDATE chain (no select — softDelete): .update().eq() → resolves */
function makeUpdateChain(result: MockResult) {
  const chain: Record<string, unknown> = {}
  chain.update = () => chain
  chain.eq     = vi.fn().mockResolvedValue(result)
  return chain
}

/** Admin SELECT chain: .select().eq().single() → resolves */
function makeAdminSelectSingleChain(result: MockResult) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq     = () => chain
  chain.single = vi.fn().mockResolvedValue(result)
  return chain
}

/** Admin SELECT chain: .select().eq().neq() → resolves (for prior commenters) */
function makeAdminSelectNeqChain(result: MockResult) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq     = () => chain
  chain.neq    = vi.fn().mockResolvedValue(result)
  return chain
}

function makeRlsClient(chainFn: () => Record<string, unknown>) {
  const from = vi.fn(() => chainFn())
  return { from } as any
}

// ---------------------------------------------------------------------------
// UUIDs (PHI-safe — no email, no display name in analytics calls)
// ---------------------------------------------------------------------------

const EVENT_ID   = 'eeeeeeee-0000-0000-0000-000000000000'
const ORG_ID     = 'ffffffff-0000-0000-0000-000000000000'
const AUTHOR_ID  = 'aaaaaaaa-0000-0000-0000-000000000000'
const COMMENTER2 = 'bbbbbbbb-0000-0000-0000-000000000000'
const COMMENT_ID = 'cccccccc-0000-0000-0000-000000000000'
const EXCLUDE_ID = 'dddddddd-0000-0000-0000-000000000000'

// ---------------------------------------------------------------------------
// (a) listComments — query shape
// ---------------------------------------------------------------------------

describe('listComments — query shape', () => {
  it('queries care_event_comments and maps rows to CareEventComment', async () => {
    const rawRow = {
      id: COMMENT_ID,
      author_id: AUTHOR_ID,
      body: 'Hello',
      edited_at: null,
      created_at: '2026-01-01T00:00:00Z',
      profiles: { display_name: 'Alice' },
    }
    const supabase = makeRlsClient(() => makeListChain({ data: [rawRow], error: null }))

    const results = await listComments(supabase, EVENT_ID)

    expect(supabase.from).toHaveBeenCalledWith('care_event_comments')
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: COMMENT_ID,
      authorId: AUTHOR_ID,
      authorName: 'Alice',
      body: 'Hello',
      editedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
    })
  })

  it('falls back to "Unknown" when profiles join is null', async () => {
    const rawRow = {
      id: COMMENT_ID,
      author_id: AUTHOR_ID,
      body: 'Hi',
      edited_at: null,
      created_at: '2026-01-02T00:00:00Z',
      profiles: null,
    }
    const supabase = makeRlsClient(() => makeListChain({ data: [rawRow], error: null }))

    const results = await listComments(supabase, EVENT_ID)

    expect(results[0].authorName).toBe('Unknown')
  })

  it('returns empty array when no comments exist', async () => {
    const supabase = makeRlsClient(() => makeListChain({ data: [], error: null }))
    const results = await listComments(supabase, EVENT_ID)
    expect(results).toHaveLength(0)
  })

  it('throws when the DB returns an error', async () => {
    const supabase = makeRlsClient(() => makeListChain({ data: null, error: { message: 'connection refused' } }))
    await expect(listComments(supabase, EVENT_ID)).rejects.toMatchObject({ message: 'connection refused' })
  })
})

// ---------------------------------------------------------------------------
// (b) insertComment — author_id comes from param (PHI check)
// ---------------------------------------------------------------------------

describe('insertComment — author_id from param', () => {
  it('writes author_id from the input param — not from session', async () => {
    const newComment = { id: COMMENT_ID, created_at: '2026-01-01T00:00:00Z' }
    const supabase = makeRlsClient(() => makeInsertChain({ data: newComment, error: null }))

    const result = await insertComment(supabase, {
      careEventId: EVENT_ID,
      orgId: ORG_ID,
      authorId: AUTHOR_ID,
      body: 'A comment',
    })

    expect(supabase.from).toHaveBeenCalledWith('care_event_comments')
    expect(result).toEqual({ id: COMMENT_ID, createdAt: '2026-01-01T00:00:00Z' })
  })

  it('throws when insert returns an error', async () => {
    const supabase = makeRlsClient(() => ({
      insert: () => ({
        select: () => ({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'RLS violation' } }),
        }),
      }),
    }))

    await expect(
      insertComment(supabase, {
        careEventId: EVENT_ID,
        orgId: ORG_ID,
        authorId: AUTHOR_ID,
        body: 'A comment',
      }),
    ).rejects.toMatchObject({ message: 'RLS violation' })
  })
})

// ---------------------------------------------------------------------------
// (c) editComment — updates body + edited_at, returns updated row
// ---------------------------------------------------------------------------

describe('editComment — updates body + edited_at', () => {
  it('returns editedAt from the updated row', async () => {
    const editedAt = '2026-06-01T12:00:00.000Z'
    const supabase = makeRlsClient(() => makeUpdateSelectChain({ data: { edited_at: editedAt }, error: null }))

    const result = await editComment(supabase, COMMENT_ID, 'Updated body')

    expect(supabase.from).toHaveBeenCalledWith('care_event_comments')
    expect(result).toEqual({ editedAt })
  })

  it('throws when update returns an error', async () => {
    const supabase = makeRlsClient(() => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'edit forbidden' } }),
          }),
        }),
      }),
    }))

    await expect(editComment(supabase, COMMENT_ID, 'New body')).rejects.toMatchObject({
      message: 'edit forbidden',
    })
  })
})

// ---------------------------------------------------------------------------
// (d) softDeleteComment — writes deleted_at, does NOT hard-delete
// ---------------------------------------------------------------------------

describe('softDeleteComment — writes deleted_at', () => {
  it('calls update (not delete) on care_event_comments', async () => {
    const supabase = makeRlsClient(() => makeUpdateChain({ data: null, error: null }))

    await softDeleteComment(supabase, COMMENT_ID)

    // Verify update path taken (not hard delete)
    expect(supabase.from).toHaveBeenCalledWith('care_event_comments')
  })

  it('throws when the soft-delete update errors', async () => {
    const supabase = makeRlsClient(() => ({
      update: () => ({
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'delete forbidden' } }),
      }),
    }))

    await expect(softDeleteComment(supabase, COMMENT_ID)).rejects.toMatchObject({
      message: 'delete forbidden',
    })
  })
})

// ---------------------------------------------------------------------------
// (e) getFanoutTargets — uses supabaseAdmin, returns UUIDs
// ---------------------------------------------------------------------------

describe('getFanoutTargets — uses supabaseAdmin', () => {
  beforeEach(() => {
    mockAdminFrom.mockReset()
  })

  it('returns orgId, eventAuthorId, and deduplicated priorCommenterIds', async () => {
    const eventRow  = { org_id: ORG_ID, actor_id: AUTHOR_ID }
    const priorRows = [{ author_id: COMMENTER2 }, { author_id: COMMENTER2 }] // duplicate → deduped

    // mockAdminFrom is called twice: first for care_events, then for care_event_comments
    mockAdminFrom
      .mockReturnValueOnce(makeAdminSelectSingleChain({ data: eventRow, error: null }))
      .mockReturnValueOnce(makeAdminSelectNeqChain({ data: priorRows, error: null }))

    const result = await getFanoutTargets(EVENT_ID, EXCLUDE_ID)

    expect(mockAdminFrom).toHaveBeenCalledWith('care_events')
    expect(mockAdminFrom).toHaveBeenCalledWith('care_event_comments')
    expect(result.orgId).toBe(ORG_ID)
    expect(result.eventAuthorId).toBe(AUTHOR_ID)
    expect(result.priorCommenterIds).toEqual([COMMENTER2]) // deduped
  })

  it('throws when the care_events lookup fails', async () => {
    mockAdminFrom.mockReturnValueOnce(
      makeAdminSelectSingleChain({ data: null, error: { message: 'event not found' } }),
    )

    await expect(getFanoutTargets(EVENT_ID, EXCLUDE_ID)).rejects.toMatchObject({
      message: 'event not found',
    })
  })

  it('throws when the prior-commenters lookup fails', async () => {
    const eventRow = { org_id: ORG_ID, actor_id: AUTHOR_ID }
    mockAdminFrom
      .mockReturnValueOnce(makeAdminSelectSingleChain({ data: eventRow, error: null }))
      .mockReturnValueOnce(makeAdminSelectNeqChain({ data: null, error: { message: 'rls admin error' } }))

    await expect(getFanoutTargets(EVENT_ID, EXCLUDE_ID)).rejects.toMatchObject({
      message: 'rls admin error',
    })
  })
})

// ---------------------------------------------------------------------------
// (f) getEventOrgId — uses supabaseAdmin, throws if event not found
// ---------------------------------------------------------------------------

describe('getEventOrgId — uses supabaseAdmin', () => {
  beforeEach(() => {
    mockAdminFrom.mockReset()
  })

  it('returns the org_id for a known event', async () => {
    mockAdminFrom.mockReturnValueOnce(
      makeAdminSelectSingleChain({ data: { org_id: ORG_ID }, error: null }),
    )

    const result = await getEventOrgId(EVENT_ID)

    expect(mockAdminFrom).toHaveBeenCalledWith('care_events')
    expect(result).toBe(ORG_ID)
  })

  it('throws when the event is not found', async () => {
    mockAdminFrom.mockReturnValueOnce(
      makeAdminSelectSingleChain({ data: null, error: { message: 'PGRST116' } }),
    )

    await expect(getEventOrgId(EVENT_ID)).rejects.toMatchObject({ message: 'PGRST116' })
  })
})
