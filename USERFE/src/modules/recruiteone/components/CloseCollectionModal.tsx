import { Check, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatDate } from '@/lib/format'
import { useStore } from '../state/RecruiteOneStore'
import type { Interview, Vacancy } from '../types'

interface CloseCollectionModalProps {
  vacancy: Vacancy
  selectedCount: number
  onClose: () => void
  onOpenInterview: (interview: Interview) => void
}

export function CloseCollectionModal({ vacancy, selectedCount, onClose, onOpenInterview }: CloseCollectionModalProps) {
  const { closeCollection } = useStore()
  const [created, setCreated] = useState<Interview | null>(null)
  const missingDates = vacancy.pipeline ? vacancy.pipeline.stages.filter((stage) => !stage.scheduled_date).length : 0
  const blocked = !vacancy.pipeline ? 'This vacancy has no pipeline yet. Schedule one from the vacancy before closing the collection.' : selectedCount === 0 ? 'Select at least one candidate first.' : null

  return (
    <Modal
      open
      onClose={onClose}
      title={created ? 'Interview created' : 'Close CV collection'}
      description={vacancy.title}
      closeOnBackdrop={false}
      footer={
        created ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Stay here
            </Button>
            <Button onClick={() => onOpenInterview(created)}>Open interview</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              icon={<Check />}
              disabled={blocked !== null}
              onClick={() => {
                const interview = closeCollection(vacancy.id)
                if (interview) setCreated(interview)
              }}
            >
              Close collection and create interview
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="wizard__done">
          <span className="wizard__done-icon" aria-hidden="true">
            <Check />
          </span>
          <h3>The collection is closed</h3>
          <p className="wizard__muted">
            An interview with {created.candidate_ids.length} {created.candidate_ids.length === 1 ? 'candidate' : 'candidates'} is ready. HR and the assigned interviewers can now open it.
          </p>
        </div>
      ) : (
        <div className="form-stack">
          <ul className="check-points">
            <li>
              <strong>{selectedCount}</strong> selected {selectedCount === 1 ? 'candidate goes' : 'candidates go'} into the interview. Selected CVs are never re-evaluated.
            </li>
            <li>No more CVs can be uploaded and the shared link stops accepting applications.</li>
            <li>The pipeline is locked. HR and the interviewers assigned to each stage will see the interview.</li>
          </ul>

          {vacancy.pipeline && (
            <div className="pipeline-summary pipeline-summary--column">
              <p className="cell-primary">{vacancy.pipeline.name}</p>
              <ol className="stage-dates">
                {vacancy.pipeline.stages.map((stage, index) => (
                  <li key={stage.id}>
                    <span>
                      {index + 1}. {stage.name}
                    </span>
                    <span className="cell-secondary">{stage.scheduled_date ? formatDate(stage.scheduled_date) : 'No date'}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {missingDates > 0 && vacancy.pipeline && (
            <div className="notice">
              <TriangleAlert aria-hidden="true" />
              <span>{missingDates} {missingDates === 1 ? 'stage has' : 'stages have'} no schedule date. You can still continue.</span>
            </div>
          )}
          {blocked && (
            <div className="notice notice--danger" role="alert">
              <TriangleAlert aria-hidden="true" />
              <span>{blocked}</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
