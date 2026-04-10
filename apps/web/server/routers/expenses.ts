import { router, protectedProcedure } from '../trpc/index'
import { TRPCError } from '@trpc/server'
import { supabaseAdmin } from '../supabaseAdmin.server'
import { expenseCreateInput, expenseListInput, expenseDeleteInput } from '@carelog/schemas'

export const expensesRouter = router({
  list: protectedProcedure
    .input(expenseListInput)
    .query(async ({ ctx, input }) => {
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('role')
        .eq('org_id', input.org_id)
        .eq('user_id', ctx.user.id)
        .not('accepted_at', 'is', null)
        .single()
      if (!membership) throw new TRPCError({ code: 'FORBIDDEN' })

      let query = supabaseAdmin
        .from('expenses')
        .select('*')
        .eq('org_id', input.org_id)
        .eq('recipient_id', input.recipient_id)
        .order('incurred_at', { ascending: false })

      if (input.since) {
        query = query.gte('incurred_at', input.since)
      }

      const { data, error } = await query
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data ?? []
    }),

  create: protectedProcedure
    .input(expenseCreateInput)
    .mutation(async ({ ctx, input }) => {
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('role')
        .eq('org_id', input.org_id)
        .eq('user_id', ctx.user.id)
        .not('accepted_at', 'is', null)
        .single()
      if (!membership || !['coordinator', 'caregiver'].includes(membership.role)) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }
      const { error } = await supabaseAdmin
        .from('expenses')
        .insert({ ...input, logged_by: ctx.user.id })
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { ok: true }
    }),

  delete: protectedProcedure
    .input(expenseDeleteInput)
    .mutation(async ({ ctx, input }) => {
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('role')
        .eq('org_id', input.org_id)
        .eq('user_id', ctx.user.id)
        .not('accepted_at', 'is', null)
        .single()
      if (!membership || membership.role !== 'coordinator') {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }
      const { error } = await supabaseAdmin
        .from('expenses')
        .delete()
        .eq('id', input.id)
        .eq('org_id', input.org_id)
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { ok: true }
    }),
})
