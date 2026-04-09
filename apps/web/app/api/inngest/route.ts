import { serve } from 'inngest/next'
import { inngest } from '../../../inngest/client'
import { weeklyDigest } from '../../../inngest/functions/weeklyDigest'
import { gapDetector } from '../../../inngest/functions/gapDetector'
import { refillAlert } from '../../../inngest/functions/refillAlert'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [weeklyDigest, gapDetector, refillAlert],
})
