import { Check, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatDate } from '@/lib/format'
import { useStore } from '../state/RecruiteOneStore'
import type { Candidate, Interview, Vacancy } from '../types'

export type PipelineScope = 'top' | 'selected' | 'scored'

interface SendToPipelineModalProps {
  vacancy: Vacancy
  batchId?: string | null
  defaultScope?: PipelineScope
  onClose: () => void
  onOpenInterview: (interview: Interview) => void
}

function byScore(a: Candidate, b: Candidate) {
  return (b.score?.overall_score ?? -1) - (a.score?.overall_score ?? -1) || a.full_name.localeCompare(b.full_name)
}

export function SendToPipelineModal({ vacancy, batchId = null, defaultScope = 'top', onClose, onOpenInterview }: SendToPipelineModalProps) {
  const { batches, candidates, interviews, addToPipeline } = useStore()
  const interview = interviews.find((item) => item.vacancy_id === vacancy.id)
  const first = vacancy.pipeline?.stages[0]
  const ownBatches = batches.filter((batch) => batch.vacancy_id === vacancy.id && (batchId === null || batch.id === batchId))
  const pool = candidates.filter((candidate) => candidate.batch_id !== null && ownBatches.some((batch) => batch.id === candidate.batch_id) && !interview?.progress[candidate.id])
  const selected = pool.filter((candidate) => candidate.selected).sort(byScore)
  const scored = pool.filter((candidate) => candidate.score !== null).sort(byScore)
  const startScope: PipelineScope = defaultScope === 'selected' && selected.length === 0 ? 'top' : defaultScope
  const [scope, setScope] = useState<PipelineScope>(startScope)
  const [typedCount, setTypedCount] = useState<number | null>(null)
  const [result, setResult] = useState<Interview | null>(null)
  const [added, setAdded] = useState(0)

  const inPipeline = Object.values(interview?.progress ?? {}).filter((progress) => progress.outcome !== 'rejected').length
  const capacity = first?.max_candidates ?? 0
  const places = Math.max(capacity - inPipeline, 0)
  const topCount = Math.max(0, Math.min(typedCount ?? (places > 0 ? Math.min(places, scored.length) : scored.length), scored.length))
  const chosen = scope === 'top' ? scored.slice(0, topCount) : scope === 'selected' ? selected : scored
  const over = chosen.length - places
  const batchName = (candidate: Candidate) => batches.find((batch) => batch.id === candidate.batch_id)?.name ?? '—'

  function send() {
    const created = addToPipeline(vacancy.id, chosen.map((candidate) => candidate.id))
    if (created) {
      setAdded(chosen.length)
      setResult(created)
    }
  }

  const where = batchId === null ? 'across all batches' : 'in this batch'

  return (
    <Modal
      open
      onClose={onClose}
      title={result ? 'Candidates are in the pipeline' : 'Proceed with the pipeline'}
      description={vacancy.title}
      closeOnBackdrop={false}
      footer={
        result ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Stay here
            </Button>
            <Button onClick={() => onOpenInterview(result)}>Open interview</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button icon={<Check />} disabled={chosen.length === 0 || !first} onClick={send}>
              Submit: send {chosen.length} to {first?.name ?? 'the pipeline'}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="wizard__done">
          <span className="wizard__done-icon" aria-hidden="true">
            <Check />
          </span>
          <h3>
            {added} {added === 1 ? 'candidate is' : 'candidates are'} in {first?.name}
          </h3>
          <p className="wizard__muted">
            They now appear under {first?.name} in the interview, and the interviewers of that stage can read their CVs. They are marked as selected, so their scores stay as they are. HR passes them to the next stage from the interview.
          </p>
        </div>
      ) : (
        <div className="form-stack">
          <div className="pipeline-summary pipeline-summary--column">
            <p className="cell-primary">
              Next round: {first?.name} <span className="cell-secondary">· {first?.scheduled_date ? formatDate(first.scheduled_date) : 'date not set'}</span>
            </p>
            <p className="cell-secondary">
              {places} of {capacity} places free
              {inPipeline > 0 ? ` · ${inPipeline} already in the pipeline` : ''}
            </p>
          </div>

          <fieldset className="scope-options">
            <legend className="field__label">Who goes to {first?.name}?</legend>
            <label className={`jd-option${scope === 'top' ? ' jd-option--selected' : ''}`}>
              <input type="radio" name="pipeline-scope" className="radio" checked={scope === 'top'} disabled={scored.length === 0} onChange={() => setScope('top')} />
              <span className="jd-option__text">
                <span className="cell-primary">Top scored CVs</span>
                <span className="cell-secondary">The highest scores {where}, ranked together. You choose how many.</span>
              </span>
            </label>
            <label className={`jd-option${scope === 'selected' ? ' jd-option--selected' : ''}`}>
              <input type="radio" name="pipeline-scope" className="radio" checked={scope === 'selected'} disabled={selected.length === 0} onChange={() => setScope('selected')} />
              <span className="jd-option__text">
                <span className="cell-primary">Selected CVs ({selected.length})</span>
                <span className="cell-secondary">The CVs you ticked {where} that are not in the pipeline yet.</span>
              </span>
            </label>
            <label className={`jd-option${scope === 'scored' ? ' jd-option--selected' : ''}`}>
              <input type="radio" name="pipeline-scope" className="radio" checked={scope === 'scored'} disabled={scored.length === 0} onChange={() => setScope('scored')} />
              <span className="jd-option__text">
                <span className="cell-primary">All scored CVs ({scored.length})</span>
                <span className="cell-secondary">Every scored CV {where} that is not in the pipeline yet.</span>
              </span>
            </label>
          </fieldset>

          {scope === 'top' && scored.length > 0 && (
            <label className="field top-count">
              <span className="field__label">Number of CVs to send (up to {scored.length})</span>
              <input
                className="input"
                type="number"
                min={1}
                max={scored.length}
                value={topCount}
                onChange={(event) => setTypedCount(Number(event.target.value) || 0)}
              />
              <span className="field__hint">Starts at the {capacity} places of {first?.name}. Change it to any amount.</span>
            </label>
          )}

          {pool.length === 0 && <p className="wizard__muted">Every CV {where} is already in the pipeline, or none has been added yet.</p>}
          {chosen.length > 0 && over > 0 && (
            <div className="notice">
              <TriangleAlert aria-hidden="true" />
              <span>
                {chosen.length} candidates exceed the {places} free places of {first?.name}. You can still send them and decide who passes later.
              </span>
            </div>
          )}

          {chosen.length > 0 && (
            <div>
              <p className="mini-heading">Will be sent ({chosen.length})</p>
              <div className="table-wrap table-wrap--plain send-preview">
                <table className="data-table data-table--compact">
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Candidate</th>
                      <th scope="col">Score</th>
                      <th scope="col">Batch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chosen.map((candidate, index) => (
                      <tr key={candidate.id}>
                        <td className="cell-secondary">{index + 1}</td>
                        <td>{candidate.full_name}</td>
                        <td>{candidate.score ? `${candidate.score.overall_score}%` : '—'}</td>
                        <td className="cell-secondary">{batchName(candidate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <p className="field__hint">Candidates in the pipeline can no longer be un-selected or re-evaluated. This works before and after the CV collection closes.</p>
        </div>
      )}
    </Modal>
  )
}
