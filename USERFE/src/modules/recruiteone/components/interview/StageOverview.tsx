import { Check, Eye } from 'lucide-react'
import { Fragment, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/format'
import { personById } from '../../data/people'
import { combinedPercent, entryFor, interviewerPercent, scorerIds, statusFor } from '../../services/interviewMath'
import { useStore } from '../../state/RecruiteOneStore'
import type { Candidate, Interview, PipelineStage } from '../../types'
import { CvViewerModal } from '../CvViewerModal'
import { ScoreBreakdown, StatusBadge } from './shared'

interface StageOverviewProps {
  interview: Interview
  stage: PipelineStage
  stageIndex: number
  stages: PipelineStage[]
  candidates: Candidate[]
  openings: number
}

function positionText(interview: Interview, candidateId: string, stages: PipelineStage[]) {
  const progress = interview.progress[candidateId]
  if (!progress) return '—'
  const name = stages[progress.stage_index]?.name ?? 'stage'
  if (progress.outcome === 'rejected') return `Rejected at ${name}`
  if (progress.outcome === 'selected') return 'Selected for offer'
  return `In ${name}`
}

export function StageOverview({ interview, stage, stageIndex, stages, candidates, openings }: StageOverviewProps) {
  const { scorecards, interviewScores, decide, decideMany } = useStore()
  const [openId, setOpenId] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Candidate | null>(null)
  const [ticked, setTicked] = useState<string[]>([])
  const [bulk, setBulk] = useState<'pass' | 'reject' | null>(null)
  const next = stages[stageIndex + 1]
  const scorers = scorerIds(stage.interviewer_ids, interviewScores, interview.id, stage.id)
  const pendingIds = candidates.filter((candidate) => statusFor(interview, candidate.id, stageIndex) === 'pending').map((candidate) => candidate.id)
  const pending = pendingIds.length
  const chosen = ticked.filter((id) => pendingIds.includes(id))
  const allTicked = pending > 0 && chosen.length === pending
  const alreadyThere = next
    ? Object.values(interview.progress).filter((progress) => progress.stage_index >= stageIndex + 1 && progress.outcome !== 'rejected').length
    : Object.values(interview.progress).filter((progress) => progress.outcome === 'selected').length
  const capacity = next ? next.max_candidates : openings
  const places = Math.max(capacity - alreadyThere, 0)
  const overCapacity = chosen.length > places
  const passLabel = next ? `Pass to ${next.name}` : 'Select for offer'

  function applyBulk() {
    if (bulk === null) return
    decideMany(interview.id, Object.fromEntries(chosen.map((id) => [id, bulk])), stages.length)
    setTicked([])
    setBulk(null)
  }

  return (
    <>
      <div className="interview-info">
        <div>
          <p className="mini-heading">Stage date</p>
          <p className="cell-primary">{stage.scheduled_date ? formatDate(stage.scheduled_date) : 'Not scheduled'}</p>
        </div>
        <div>
          <p className="mini-heading">Capacity</p>
          <p className="cell-primary">
            {pending} pending of {stage.max_candidates} places
          </p>
        </div>
        <div className="interview-info__people">
          <p className="mini-heading">Interviewers</p>
          <ul className="stage-view__people">
            {stage.interviewer_ids.map((id) => {
              const person = personById(id)
              return person ? (
                <li key={id}>
                  <Avatar name={person.name} small />
                  <span>{person.name}</span>
                </li>
              ) : null
            })}
          </ul>
        </div>
      </div>

      {pending > 0 && (
        <>
          <div className="results-bar">
            <div className="results-bar__facts">
              <p className="mini-heading">{next ? `Places in ${next.name}` : 'Openings for this vacancy'}</p>
              <p className="cell-primary">
                {places} available{' '}
                <span className="cell-secondary">
                  of {capacity}
                  {alreadyThere > 0 ? ` · ${alreadyThere} already taken` : ''}
                </span>
              </p>
            </div>
            <div className="results-bar__controls">
              <Button variant="secondary" onClick={() => setTicked(allTicked ? [] : pendingIds)}>
                {allTicked ? 'Clear selection' : `Select all pending (${pending})`}
              </Button>
              <Button disabled={chosen.length === 0 || overCapacity} onClick={() => setBulk('pass')}>
                {passLabel} ({chosen.length})
              </Button>
              <Button variant="secondary" disabled={chosen.length === 0} onClick={() => setBulk('reject')}>
                Reject ({chosen.length})
              </Button>
            </div>
          </div>
          {overCapacity && (
            <p className="field__error" role="alert">
              {chosen.length} selected but only {places} {places === 1 ? 'place is' : 'places are'} available. Remove {chosen.length - places} to continue.
            </p>
          )}
        </>
      )}

      {candidates.length === 0 ? (
        <EmptyState icon={<Check />} title="No candidates" description="No candidates are in the interview yet. Send scored CVs to the pipeline from the CV Pool, or close the CV collection." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {pending > 0 && (
                  <th scope="col">
                    <input
                      type="checkbox"
                      className="checkbox"
                      aria-label="Select all pending candidates"
                      checked={allTicked}
                      onChange={() => setTicked(allTicked ? [] : pendingIds)}
                    />
                  </th>
                )}
                <th scope="col">Candidate</th>
                <th scope="col">Where they are</th>
                {scorers.map((id) => (
                  <th key={id} scope="col">
                    {personById(id)?.name ?? id}
                  </th>
                ))}
                <th scope="col">Combined</th>
                <th scope="col">At this stage</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => {
                const percents = scorers.map((id) => interviewerPercent(scorecards, interviewScores, interview.id, stage.id, id, candidate.id))
                const combined = combinedPercent(percents)
                const status = statusFor(interview, candidate.id, stageIndex)
                const reached = status !== 'not_reached'
                const isOpen = openId === candidate.id
                return (
                  <Fragment key={candidate.id}>
                    <tr
                      className={`${reached ? 'row-clickable' : ''}${chosen.includes(candidate.id) ? ' row-selected' : ''}`.trim() || undefined}
                      onClick={() => reached && setOpenId(isOpen ? null : candidate.id)}
                    >
                      {pending > 0 && (
                        <td onClick={(event) => event.stopPropagation()}>
                          {status === 'pending' && (
                            <input
                              type="checkbox"
                              className="checkbox"
                              aria-label={`Select ${candidate.full_name}`}
                              checked={chosen.includes(candidate.id)}
                              onChange={(event) => setTicked((current) => (event.target.checked ? [...current, candidate.id] : current.filter((id) => id !== candidate.id)))}
                            />
                          )}
                        </td>
                      )}
                      <td className="cell-wide">
                        <div className="cell-person">
                          <Avatar name={candidate.full_name} small />
                          <div>
                            {reached ? (
                              <button type="button" className="link-button" aria-expanded={isOpen} onClick={() => setOpenId(isOpen ? null : candidate.id)}>
                                {candidate.full_name}
                              </button>
                            ) : (
                              <span className="cell-primary">{candidate.full_name}</span>
                            )}
                            <p className="cell-secondary">{candidate.current_title || candidate.file_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="cell-secondary nowrap">{positionText(interview, candidate.id, stages)}</td>
                      {percents.map((percent, index) => (
                        <td key={scorers[index]}>{percent === null ? <span className="cell-secondary">—</span> : `${percent}%`}</td>
                      ))}
                      <td>
                        <strong>{combined === null ? '—' : `${combined}%`}</strong>
                      </td>
                      <td>
                        <StatusBadge status={status} />
                      </td>
                      <td className="align-right nowrap" onClick={(event) => event.stopPropagation()}>
                        <Button size="sm" variant="secondary" icon={<Eye />} aria-label={`View CV of ${candidate.full_name}`} onClick={() => setViewing(candidate)}>
                          View CV
                        </Button>{' '}
                        {status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              icon={<Check />}
                              title={passLabel}
                              aria-label={`${passLabel}: ${candidate.full_name}`}
                              onClick={() => decide(interview.id, candidate.id, 'pass', stages.length)}
                            >
                              {next ? 'Pass' : 'Select for offer'}
                            </Button>{' '}
                            <Button size="sm" variant="secondary" onClick={() => decide(interview.id, candidate.id, 'reject', stages.length)}>
                              Reject
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="detail-row">
                        <td colSpan={scorers.length + (pending > 0 ? 6 : 5)}>
                          <ScoreBreakdown
                            interviewerIds={scorers}
                            cards={scorecards}
                            entryFor={(interviewerId) => entryFor(interviewScores, interview.id, stage.id, interviewerId, candidate.id)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmModal
        open={bulk !== null}
        title={bulk === 'reject' ? 'Reject selected candidates?' : passLabel}
        message={
          bulk === 'reject'
            ? `${chosen.length} ${chosen.length === 1 ? 'candidate' : 'candidates'} will be rejected at ${stage.name}.`
            : `${chosen.length} ${chosen.length === 1 ? 'candidate' : 'candidates'} will ${next ? `move to ${next.name}` : 'be selected for the offer'}.`
        }
        confirmLabel={bulk === 'reject' ? 'Reject' : 'Confirm'}
        cancelLabel="Cancel"
        danger={bulk === 'reject'}
        onConfirm={applyBulk}
        onCancel={() => setBulk(null)}
      />
      {viewing && <CvViewerModal candidate={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}
