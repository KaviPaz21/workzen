import { Check, Eye } from 'lucide-react'
import { Fragment, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
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
}

function positionText(interview: Interview, candidateId: string, stages: PipelineStage[]) {
  const progress = interview.progress[candidateId]
  if (!progress) return '—'
  const name = stages[progress.stage_index]?.name ?? 'stage'
  if (progress.outcome === 'rejected') return `Rejected at ${name}`
  if (progress.outcome === 'selected') return 'Selected for offer'
  return `In ${name}`
}

export function StageOverview({ interview, stage, stageIndex, stages, candidates }: StageOverviewProps) {
  const { scorecards, interviewScores, decide } = useStore()
  const [openId, setOpenId] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Candidate | null>(null)
  const next = stages[stageIndex + 1]
  const scorers = scorerIds(stage.interviewer_ids, interviewScores, interview.id, stage.id)
  const pending = candidates.filter((candidate) => statusFor(interview, candidate.id, stageIndex) === 'pending').length

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

      {candidates.length === 0 ? (
        <EmptyState icon={<Check />} title="No candidates" description="This interview has no candidates." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
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
                    <tr className={reached ? 'row-clickable' : undefined} onClick={() => reached && setOpenId(isOpen ? null : candidate.id)}>
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
                            <Button size="sm" icon={<Check />} onClick={() => decide(interview.id, candidate.id, 'pass', stages.length)}>
                              {next ? `Pass to ${next.name}` : 'Select for offer'}
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
                        <td colSpan={scorers.length + 5}>
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
      {viewing && <CvViewerModal candidate={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}
