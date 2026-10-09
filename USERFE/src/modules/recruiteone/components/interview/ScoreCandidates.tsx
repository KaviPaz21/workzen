import { Check } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ResizableColumns } from '@/components/ui/ResizableColumns'
import { commonCard, entryFor, isComplete, personalCard, scorePercent, statusFor, totalMax } from '../../services/interviewMath'
import { useCurrentUser } from '../../state/CurrentUser'
import { useStore } from '../../state/RecruiteOneStore'
import type { Candidate, Interview, InterviewScore, PipelineStage, Scorecard } from '../../types'
import { CvPreview } from '../CvPreview'
import { cardLabel } from './shared'

interface ScoreCandidatesProps {
  interview: Interview
  stage: PipelineStage
  stageIndex: number
  candidates: Candidate[]
  onCreateScorecard: () => void
}

export function ScoreCandidates({ interview, stage, stageIndex, candidates, onCreateScorecard }: ScoreCandidatesProps) {
  const { user } = useCurrentUser()
  const { scorecards, interviewScores } = useStore()
  const [candidateId, setCandidateId] = useState<string | null>(null)
  const [cardId, setCardId] = useState<string | null>(null)

  const mine = personalCard(scorecards, interview.id, stage.id, user.id)
  const common = commonCard(scorecards, interview.id, stage.id)
  const options = [mine, common].filter((card): card is Scorecard => card !== undefined)
  const card = options.find((item) => item.id === cardId) ?? options[0]
  const candidate = candidates.find((item) => item.id === candidateId) ?? candidates[0]
  const entry = candidate ? entryFor(interviewScores, interview.id, stage.id, user.id, candidate.id) : undefined

  const left = (
    <>
      <p className="mini-heading">Candidates</p>
      <ul className="score-layout__people">
        {candidates.map((item) => {
          const saved = entryFor(interviewScores, interview.id, stage.id, user.id, item.id)
          const percent = scorePercent(scorecards.find((entryCard) => entryCard.id === saved?.scorecard_id), saved)
          const status = statusFor(interview, item.id, stageIndex)
          return (
            <li key={item.id}>
              <button type="button" className="score-candidate" aria-current={item.id === candidate?.id ? 'true' : undefined} onClick={() => setCandidateId(item.id)}>
                <Avatar name={item.full_name} small />
                <span className="score-candidate__text">
                  <span className="cell-primary">{item.full_name}</span>
                  <span className="cell-secondary">{status === 'pending' ? (percent === null ? 'Not scored by you' : `You: ${percent}%`) : 'Decision made'}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )

  const center = candidate ? <CvPreview key={candidate.id} candidate={candidate} /> : <p className="wizard__muted">No candidate selected.</p>

  const right = (
    <>
      <div className="score-layout__card-head">
        <div>
          <h3>Scorecard</h3>
          <p className="cell-secondary">Only you and HR can see your scores.</p>
        </div>
      </div>
      {!card ? (
        <div className="score-empty">
          <p className="cell-primary">No scorecard for this stage yet.</p>
          <p className="wizard__muted">Create a scorecard first, then come back to score candidates.</p>
          <Button onClick={onCreateScorecard}>Create scorecard</Button>
        </div>
      ) : (
        <>
          {options.length > 1 && (
            <label className="field">
              <span className="field__label">Scorecard in use</span>
              <select className="select select--full" value={card.id} onChange={(event) => setCardId(event.target.value)}>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {cardLabel(option)}
                    {option.interviewer_id === user.id ? ' (mine)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          {candidate ? (
            <ScoreForm key={`${candidate.id}-${card.id}`} interview={interview} stage={stage} stageIndex={stageIndex} candidate={candidate} card={card} entry={entry} />
          ) : (
            <p className="wizard__muted">Pick a candidate to score.</p>
          )}
        </>
      )}
    </>
  )

  return (
    <ResizableColumns
      storageKey="workzen.score-panes"
      leftLabel="Resize candidate list"
      rightLabel="Resize scorecard"
      left={left}
      center={center}
      right={right}
    />
  )
}

interface ScoreFormProps {
  interview: Interview
  stage: PipelineStage
  stageIndex: number
  candidate: Candidate
  card: Scorecard
  entry: InterviewScore | undefined
}

function ScoreForm({ interview, stage, stageIndex, candidate, card, entry }: ScoreFormProps) {
  const { user } = useCurrentUser()
  const { saveScore } = useStore()
  const sameCard = entry?.scorecard_id === card.id
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(card.criteria.map((criterion) => [criterion.id, sameCard && typeof entry?.values[criterion.id] === 'number' ? String(entry.values[criterion.id]) : ''])),
  )
  const [notes, setNotes] = useState(sameCard ? (entry?.notes ?? '') : '')
  const [saved, setSaved] = useState(false)
  const locked = statusFor(interview, candidate.id, stageIndex) !== 'pending'

  const numeric = Object.fromEntries(
    card.criteria.filter((criterion) => values[criterion.id] !== '').map((criterion) => [criterion.id, Number(values[criterion.id])]),
  ) as Record<string, number>
  const draft: InterviewScore = {
    id: 'draft',
    interview_id: interview.id,
    stage_id: stage.id,
    interviewer_id: user.id,
    scorecard_id: card.id,
    candidate_id: candidate.id,
    values: numeric,
    notes,
    updated_at: '',
  }
  const percent = scorePercent(card, draft)

  return (
    <div className="score-form">
      <p className="score-form__candidate">
        <strong>{candidate.full_name}</strong>
        {locked && <span className="cell-secondary"> · HR has made a decision, so scores are read-only</span>}
      </p>
      {entry && !sameCard && <p className="field__hint">You scored this candidate with a different scorecard. Saving replaces those scores.</p>}
      <ul className="score-form__list">
        {card.criteria.map((criterion) => (
          <li key={criterion.id} className="criterion">
            <label htmlFor={`score-${criterion.id}`} className="criterion__name">
              {criterion.name}
            </label>
            <span className="criterion__input">
              <input
                id={`score-${criterion.id}`}
                className="input"
                type="number"
                min={0}
                max={criterion.max_score}
                disabled={locked}
                value={values[criterion.id]}
                onChange={(event) => {
                  setSaved(false)
                  const raw = event.target.value
                  setValues((current) => ({ ...current, [criterion.id]: raw === '' ? '' : String(Math.max(0, Math.min(criterion.max_score, Number(raw)))) }))
                }}
              />
              <span className="cell-secondary">/ {criterion.max_score}</span>
            </span>
          </li>
        ))}
      </ul>
      <label className="field">
        <span className="field__label">Notes</span>
        <textarea
          className="textarea"
          rows={3}
          disabled={locked}
          value={notes}
          onChange={(event) => {
            setSaved(false)
            setNotes(event.target.value)
          }}
        />
      </label>
      <div className="score-form__foot">
        <span className="score-form__total">
          {percent === null ? `Score every item for a result (max ${totalMax(card.criteria)} points)` : `Your result: ${percent}%`}
        </span>
        {saved && (
          <span className="saved-note">
            <Check aria-hidden="true" /> Saved
          </span>
        )}
        <Button
          disabled={locked}
          onClick={() => {
            saveScore({ interviewId: interview.id, stageId: stage.id, interviewerId: user.id, scorecardId: card.id, candidateId: candidate.id, values: numeric, notes })
            setSaved(true)
          }}
        >
          Save scores
        </Button>
      </div>
      {!isComplete(card, draft) && Object.keys(numeric).length > 0 && <p className="field__hint">Partly scored results are saved but only count once every item has a score.</p>}
    </div>
  )
}
