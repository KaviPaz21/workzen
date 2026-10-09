import { CloudOff, LoaderCircle, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useStore } from '@/modules/recruiteone/state/RecruiteOneStore'

export function WorkspaceGate({ children }: { children: ReactNode }) {
  const { status, loadError, reload, saveError, dismissSaveError } = useStore()

  if (status === 'loading') {
    return (
      <div className="gate" role="status">
        <LoaderCircle className="gate__spinner" aria-hidden="true" />
        <p className="cell-primary">Loading your workspace</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <EmptyState
        icon={<CloudOff />}
        title="The workspace could not be loaded"
        description={loadError ?? 'Check that the back end is running and its database settings are correct.'}
        action={<Button onClick={reload}>Try again</Button>}
      />
    )
  }

  return (
    <>
      {saveError && (
        <div className="notice notice--danger save-banner" role="alert">
          <TriangleAlert aria-hidden="true" />
          <span>Your last change may not have been saved. {saveError}</span>
          <Button size="sm" variant="secondary" onClick={dismissSaveError}>
            Dismiss
          </Button>
        </div>
      )}
      {children}
    </>
  )
}
