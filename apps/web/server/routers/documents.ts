import { z } from 'zod'
import { router, protectedProcedure } from '../trpc/index'
import { TRPCError } from '@trpc/server'
import { supabaseAdmin } from '../supabaseAdmin.server'

const listInput = z.object({
  org_id:       z.string().uuid(),
  recipient_id: z.string().uuid(),
})

const deleteInput = z.object({
  id:     z.string().uuid(),
  org_id: z.string().uuid(),
})

export const documentsRouter = router({
  list: protectedProcedure
    .input(listInput)
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
        .from('documents')
        .select('id, display_name, doc_type, file_size, uploaded_by, created_at')
        .eq('org_id', input.org_id)
        .eq('recipient_id', input.recipient_id)
        .order('created_at', { ascending: false })
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data ?? []
    }),

  delete: protectedProcedure
    .input(deleteInput)
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

      const { data: doc, error: fetchError } = await supabaseAdmin
        .from('documents')
        .select('storage_path')
        .eq('id', input.id)
        .eq('org_id', input.org_id)
        .single()
      if (fetchError || !doc) throw new TRPCError({ code: 'NOT_FOUND' })

      await supabaseAdmin.storage.from('care-documents').remove([doc.storage_path])

      const { error } = await supabaseAdmin
        .from('documents')
        .delete()
        .eq('id', input.id)
        .eq('org_id', input.org_id)
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { ok: true }
    }),
})
