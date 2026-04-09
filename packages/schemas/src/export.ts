import { z } from 'zod'

export const exportRequestSchema = z.object({
  orgId:       z.string().uuid(),
  recipientId: z.string().uuid(),
  format:      z.enum(['json', 'pdf']),
  since:       z.string().datetime({ offset: true }).optional(),
})

export type ExportRequest = z.infer<typeof exportRequestSchema>
