import { Inngest, InngestMiddleware } from 'inngest'
import * as Sentry from '@sentry/nextjs'

const sentryMiddleware = new InngestMiddleware({
  name: 'Sentry error capture',
  init() {
    return {
      onFunctionRun({ fn }) {
        return {
          transformOutput(ctx) {
            if (ctx.result.error) {
              Sentry.captureException(ctx.result.error, {
                tags: { inngest_function: fn.id() },
              })
            }
            return ctx
          },
        }
      },
    }
  },
})

export const inngest = new Inngest({
  id: 'carelog',
  middleware: [sentryMiddleware],
})
