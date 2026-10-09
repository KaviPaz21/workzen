import { Eye } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { EmptyState } from '@/components/ui/EmptyState'
import { personById } from '../../data/people'
import { combinedPercent, entryFor, interviewerPercent, scorerIds, statusFor } from '../../services/interviewMath'
import { useStore } from '../../state/RecruiteOneStore'
import type { Candidate, Interview, PipelineStage } from '../../types'
import { CvViewerModal } from '../CvViewerModal'
import { ScoreBreakdown, StatusBadge } from './shared'

interface ResultsTabProps {
  interview: Interview
  stage: PipelineStage
  stageIndex: number
  stages: PipelineStage[]
  candidates: Candidate[]
  openings: number
}

interface Row {
  candidate: Candidate
  percents: (number | null)[]
  combined: number | null
  previous: number | null
  status: ReturnType<typeof statusFor>
}

type Mode = 'manual' | 'top'

export function ResultsTab({ interview, stage, stageIndex, stages, candidates, openings }: ResultsTabProps) {
  const { scorecards, interviewScores, decideMany } = useStore()
  const [mode, setMode] = useState<Mode>('top')
  const [chosen, setChosen] = useState<string[]>([])
  const [topCount, setTopCount] = useState<number | null>(null)
  const [rejectRest, setRejectRest] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Candidate | null>(null)
  const [confirming, setConfirming] = useState(false)

  const next = stages[stageIndex + 1]
  const previousStage = stages[stageIndex - 1]
  const scorers = scorerIds(stage.interviewer_ids, interviewScores, interview.id, stage.id)

  const rows = useMemo<Row[]>(() => {
    const built = candidates.map((candidate) => {
      const percents = scorers.map((id) => interviewerPercent(scorecards, interviewScores, interview.id, stage.id, id, candidate.id))
      const previousPercents = previousStage
        ? scorerIds(previousStage.interviewer_ids, interviewScores, interview.id, previousStage.id).map((id) => interviewerPercent(scorecards, interviewScores, interview.id, previousStage.id, id, candidate.id))
        : []
      return {
        candidate,
        percents,
        combined: combinedPercent(percents),
        previous: previousStage ? combinedPercent(previousPercents) : null,
        status: statusFor(interview, candidate.id, stageIndex),
      }
    })
    return built.sort((a, b) => (b.combined ?? -1) - (a.combined ?? -1))
  }, [candidates, scorers, stage, previousStage, scorecards, interviewScores, interview, stageIndex])

  const pendingRows = rows.filter((row) => row.status === 'pending')
  const alreadyThere = next
    ? Object.values(interview.progress).filter((progress) => progress.stage_index >= stageIndex + 1 && progress.outcome !== 'rejected').length
    : Object.values(interview.progress).filter((progress) => progress.outcome === 'selected').length
  const capacity = next ? next.max_candidates : openings
  const places = Math.max(capacity - alreadyThere, 0)
  const count = Math.max(0, Math.min(topCount ?? Math.min(places, pendingRows.length), pendingRows.length))

  const selectedIds = mode === 'top' ? pendingRows.slice(0, count).map((row) => row.candidate.id) : chosen.filter((id) => pendingRows.some((row) => row.candidate.id === id))
  const overCapacity = selectedIds.length > places
  const label = next ? `Pass to ${next.name}` : 'Select for offer'
  const unscored = selectedIds.filter((id) => rows.find((row) => row.candidate.id === id)?.combined === null).length

  function confirm() {
    const decisions: Record<string, 'pass' | 'reject'> = {}
    for (const row of pendingRows) {
      if (selectedIds.includes(row.candidate.id)) decisions[row.candidate.id] = 'pass'
      else if (rejectRest) decisions[row.candidate.id] = 'reject'
    }
    decideMany(interview.id, decisions, stages.length)
    setChosen([])
    setTopCount(null)
    setConfirming(false)
  }

  if (candidates.length === 0) {
    return <EmptyState icon={<Eye />} title="No candidates" description="Candidates appear here once they reach this stage." />
  }

  const columnCount = scorers.length + (pendingRows.length > 0 && mode === 'manual' ? 7 : 6)

  return (
    <>
      <div className="results-bar">
        <div className="results-bar__facts">
          <p className="mini-heading">{next ? `Places in ${next.name}` : 'Openings for this vacancy'}</p>
          <p className="cell-primary">
            {places} available <span className="cell-secondary">of {capacity}{alreadyThere > 0 ? ` · ${alreadyThere} already taken` : ''}</span>
          </p>
        </div>
        {pendingRows.length > 0 ? (
          <div className="results-bar__controls">
            <div className="segmented" role="group" aria-label="Selection method">
              <button type="button" aria-pressed={mode === 'top'} onClick={() => setMode('top')}>
                Select top scorers
              </button>
              <button type="button" aria-pressed={mode === 'manual'} onClick={() => setMode('manual')}>
                Choose candidates
              </button>
            </div>
            {mode === 'top' && (
              <label className="results-bar__count">
                <span>Top</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={pendingRows.length}
                  value={count}
                  aria-label="Number of top candidates to select"
                  onChange={(event) => setTopCount(Number(event.target.value) || 0)}
                />
              </label>
            )}
            <label className="check-inline">
              <input type="checkbox" checked={rejectRest} onChange={(event) => setRejectRest(event.target.checked)} />
              <span>Reject the rest</span>
            </label>
            <Button disabled={selectedIds.length === 0 || overCapacity} onClick={() => setConfirming(true)}>
              {label} ({selectedIds.length})
            </Button>
          </div>
        ) : (
          <p className="wizard__muted">Every candidate at this stage has a decision.</p>
        )}
      </div>
      {overCapacity && (
        <p className="field__error" role="alert">
          {selectedIds.length} selected but only {places} {places === 1 ? 'place is' : 'places are'} available. Remove {selectedIds.length - places} to continue.
        </p>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {pendingRows.length > 0 && mode === 'manual' && (
                <th scope="col">
                  <span className="sr-only">Select</span>
                </th>
              )}
              <th scope="col">Rank</th>
              <th scope="col">Candidate</th>
              {scorers.map((id) => (
                <th key={id} scope="col">
                  {personById(id)?.name ?? id}
                </th>
              ))}
              <th scope="col">Combined</th>
              <th scope="col">{previousStage ? `${previousStage.name} score` : 'Earlier score'}</th>
              <th scope="col">Selection</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const id = row.candidate.id
              const isOpen = openId === id
              const picked = selectedIds.includes(id)
              return (
                <Fragment key={id}>
                  <tr className={picked ? 'row-selected' : undefined}>
                    {pendingRows.length > 0 && mode === 'manual' && (
                      <td>
                        {row.status === 'pending' && (
                          <input
                            type="checkbox"
                            aria-label={`Select ${row.candidate.full_name}`}
                            checked={chosen.includes(id)}
                            onChange={(event) => setChosen((current) => (event.target.checked ? [...current, id] : current.filter((item) => item !== id)))}
                          />
                        )}
                      </td>
                    )}
                    <td>{index + 1}</td>
                    <td className="cell-wide">
                      <div className="cell-person">
                        <Avatar name={row.candidate.full_name} small />
                        <div>
                          <button type="button" className="link-button" aria-expanded={isOpen} onClick={() => setOpenId(isOpen ? null : id)}>
                            {row.candidate.full_name}
                          </button>
                          <p className="cell-secondary">{row.candidate.current_title || row.candidate.file_name}</p>
                        </div>
                        <button type="button" className="icon-button icon-button--small" aria-label={`View CV of ${row.candidate.full_name}`} onClick={() => setViewing(row.candidate)}>
                          <Eye />
                        </button>
                      </div>
                    </td>
                    {row.percents.map((percent, position) => (
                      <td key={scorers[position]}>{percent === null ? <span className="cell-secondary">—</span> : `${percent}%`}</td>
                    ))}
                    <td>
                      <strong>{row.combined === null ? '—' : `${row.combined}%`}</strong>
                    </td>
                    <td>{row.previous === null ? <span className="cell-secondary">—</span> : `${row.previous}%`}</td>
                    <td>
                      {row.status === 'pending' ? (
                        picked ? <span className="badge badge--outline">{label}</span> : <span className="cell-secondary">{rejectRest && selectedIds.length > 0 ? 'Will be rejected' : 'Not selected'}</span>
                      ) : (
                        <StatusBadge status={row.status} />
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="detail-row">
                      <td colSpan={columnCount}>
                        <ScoreBreakdown
                          interviewerIds={scorers}
                          cards={scorecards}
                          entryFor={(interviewerId) => entryFor(interviewScores, interview.id, stage.id, interviewerId, id)}
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

      <ConfirmModal
        open={confirming}
        title={label}
        message={`${selectedIds.length} ${selectedIds.length === 1 ? 'candidate' : 'candidates'} will ${next ? `move to ${next.name}` : 'be selected for the offer'}.${
          rejectRest && pendingRows.length > selectedIds.length ? ` The other ${pendingRows.length - selectedIds.length} pending will be rejected.` : ''
        }${unscored > 0 ? ` ${unscored} of them have no complete score yet.` : ''}`}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        onConfirm={confirm}
        onCancel={() => setConfirming(false)}
      />
      {viewing && <CvViewerModal candidate={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}
