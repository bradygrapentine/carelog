import { z } from 'zod'
import { router, protectedProcedure } from '../trpc/index'
import { TRPCError } from '@trpc/server'
import { supabaseAdmin } from '../supabaseAdmin.server'

const screenInput = z.object({
  org_id:       z.string().uuid(),
  recipient_id: z.string().uuid(),
  answers:      z.object({
    age65plus:        z.boolean(),
    veteran:          z.boolean(),
    lowIncome:        z.boolean(),
    medicareEnrolled: z.boolean(),
    medicaidEnrolled: z.boolean(),
  }),
  results: z.array(z.object({
    key:         z.string(),
    name:        z.string(),
    description: z.string(),
    applyUrl:    z.string(),
  })),
})

const latestInput = z.object({
  org_id:       z.string().uuid(),
  recipient_id: z.string().uuid(),
})

async function assertCoordinator(orgId: string, userId: string) {
  const { data: membership } = await supabaseAdmin
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .single()
  if (!membership || membership.role !== 'coordinator') {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }
}

export const benefitsRouter = router({
  screen: protectedProcedure
    .input(screenInput)
    .mutation(async ({ ctx, input }) => {
      await assertCoordinator(input.org_id, ctx.user.id)
      const { error } = await supabaseAdmin
        .from('benefits_screenings')
        .insert({
          org_id:       input.org_id,
          recipient_id: input.recipient_id,
          answers:      input.answers,
          results:      input.results,
          created_by:   ctx.user.id,
        })
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { ok: true }
    }),

  latest: protectedProcedure
    .input(latestInput)
    .query(async ({ ctx, input }) => {
      await assertCoordinator(input.org_id, ctx.user.id)
      const { data, error } = await supabaseAdmin
        .from('benefits_screenings')
        .select('*')
        .eq('org_id', input.org_id)
        .eq('recipient_id', input.recipient_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (error && error.code !== 'PGRST116') {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }
      return data ?? null
    }),
})
