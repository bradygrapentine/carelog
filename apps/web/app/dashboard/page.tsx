import { ErrorBoundary } from '../../components/ErrorBoundary'
import { DashboardClient } from './DashboardClient'

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <DashboardClient />
    </ErrorBoundary>
  )
}
