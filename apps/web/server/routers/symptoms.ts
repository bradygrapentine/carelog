import { z } from 'zod'
import { router, protectedProcedure } from '../trpc/index'
import { TRPCError } from '@trpc/server'
import { supabaseAdmin } from '../supabaseAdmin.server'
import { symptomLogInput, symptomListInput } from '@carelog/schemas'

export const symptomsRouter = router({
  list: protectedProcedure
    .input(symptomListInput)
    .query(async ({ ctx, input }) => {
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('role')
        .eq('org_id', input.org_id)
        .eq('user_id', ctx.user.id)
        .not('accepted_at', 'is', null)
        .single()
      if (!membership) throw new TRPCError({ code: 'FORBIDDEN' })

      const { data, error } = await supabaseAdmin
        .from('symptom_readings')
        .select('*')
        .eq('org_id', input.org_id)
        .eq('recipient_id', input.recipient_id)
        .order('recorded_at', { ascending: false })
        .limit(30)
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data ?? []
    }),

  log: protectedProcedure
    .input(symptomLogInput)
    .mutation(async ({ ctx, input }) => {
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('role')
        .eq('org_id', input.org_id)
        .eq('user_id', ctx.user.id)
        .not('accepted_at', 'is', null)
        .single()
      if (!membership || membership.role === 'supporter') {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }
      const { error } = await supabaseAdmin
        .from('symptom_readings')
        .insert({ ...input, logged_by: ctx.user.id })
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { ok: true }
    }),
})
