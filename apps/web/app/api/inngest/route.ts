import { serve } from 'inngest/next'
import { inngest } from '../../../inngest/client'
import { weeklyDigest } from '../../../inngest/functions/weeklyDigest'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [weeklyDigest],
})
