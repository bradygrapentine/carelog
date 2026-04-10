'use client'

import { use, Suspense } from 'react'
import { ErrorBoundary } from '../../../../components/ErrorBoundary'
import { JournalClient } from './JournalClient'

export default function JournalPage({
  params,
}: Readonly<{
  params: Promise<{ recipientId: string }>
}>) {
  const { recipientId } = use(params)
  return (
    <ErrorBoundary>
      <Suspense>
        <JournalClient recipientId={recipientId} />
      </Suspense>
    </ErrorBoundary>
  )
}
