import { GitBranch, Lock, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/format'
import { personById } from '../data/people'
import { useStore } from '../state/RecruiteOneStore'
import type { Pipeline, Vacancy } from '../types'
import { emptyPipeline, isPipelineValid, PipelineEditor } from './PipelineEditor'

export function PipelineStageList({ pipeline }: { pipeline: Pipeline }) {
  return (
    <div className="form-stack">
      <div>
        <p className="cell-primary">{pipeline.name}</p>
        <p className="wizard__muted">{pipeline.description || 'No description.'}</p>
      </div>
      <ol className="stage-view">
        {pipeline.stages.map((item, index) => (
          <li key={item.id} className="stage-view__item">
            <span className="stage__number">{index + 1}</span>
            <div className="stage-view__main">
              <p className="cell-primary">{item.name}</p>
              <p className="cell-secondary">
                {item.scheduled_date ? formatDate(item.scheduled_date) : 'No date set'} · up to {item.max_candidates} candidates
              </p>
            </div>
            <ul className="stage-view__people">
              {item.interviewer_ids.map((id) => {
                const person = personById(id)
                return person ? (
                  <li key={id} title={`${person.name}, ${person.role}`}>
                    <Avatar name={person.name} small />
                    <span>{person.name}</span>
                  </li>
                ) : null
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function VacancyPipelineTab({ vacancy }: { vacancy: Vacancy }) {
  const { updateVacancy } = useStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Pipeline>(vacancy.pipeline ?? emptyPipeline())
  const locked = vacancy.collection_closed_at !== null

  function startEditing() {
    setDraft(vacancy.pipeline ?? emptyPipeline())
    setEditing(true)
  }

  if (editing) {
    return (
      <div className="form-stack">
        <PipelineEditor value={draft} onChange={setDraft} />
        <div className="option__confirm">
          <Button
            disabled={!isPipelineValid(draft)}
            onClick={() => {
              updateVacancy(vacancy.id, { pipeline: draft })
              setEditing(false)
            }}
          >
            Save pipeline
          </Button>
          <Button variant="secondary" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          {!isPipelineValid(draft) && <span className="field__hint">Add a pipeline name and give every stage a name and at least one interviewer.</span>}
        </div>
      </div>
    )
  }

  if (!vacancy.pipeline) {
    return (
      <EmptyState
        icon={<GitBranch />}
        title="No pipeline scheduled"
        description="Add interview stages with dates and interviewers. A pipeline is needed before the CV collection can be closed."
        action={
          !locked ? (
            <Button icon={<Pencil />} onClick={startEditing}>
              Schedule pipeline
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <div className="form-stack">
      <div className="pipeline-actions">
        {locked ? (
          <span className="wizard__muted">
            <Lock aria-hidden="true" className="inline-icon" />
            The pipeline is locked because the CV collection was closed on {formatDate(vacancy.collection_closed_at)}.
          </span>
        ) : (
          <Button size="sm" variant="secondary" icon={<Pencil />} onClick={startEditing}>
            Edit pipeline
          </Button>
        )}
      </div>
      <PipelineStageList pipeline={vacancy.pipeline} />
    </div>
  )
}
