import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { personById } from '../../data/people'
import { totalMax, type StageStatus } from '../../services/interviewMath'
import type { Criterion, InterviewScore, Scorecard } from '../../types'

export function StatusBadge({ status }: { status: StageStatus }) {
  if (status === 'passed') return <Badge tone="success">Passed</Badge>
  if (status === 'selected') return <Badge tone="success">Selected for offer</Badge>
  if (status === 'rejected') return <Badge tone="danger">Rejected</Badge>
  if (status === 'not_reached') return <Badge tone="neutral">Not reached</Badge>
  return <Badge tone="warning">Pending decision</Badge>
}

export function cardLabel(card: Scorecard | undefined) {
  if (!card) return 'No scorecard'
  return card.interviewer_id === null ? 'Common scorecard' : `${personById(card.interviewer_id)?.name ?? 'Interviewer'}'s scorecard`
}

export function CriteriaList({ card }: { card: Scorecard }) {
  return (
    <ul className="criteria-list">
      {card.criteria.map((criterion) => (
        <li key={criterion.id}>
          <span>{criterion.name}</span>
          <span className="cell-secondary">up to {criterion.max_score}</span>
        </li>
      ))}
      <li className="criteria-list__total">
        <span>Total</span>
        <span>{totalMax(card.criteria)} points</span>
      </li>
    </ul>
  )
}

function blankCriterion(): Criterion {
  return { id: `cr-${crypto.randomUUID().slice(0, 6)}`, name: '', max_score: 10 }
}

interface ScorecardBuilderProps {
  initial: Criterion[]
  saveLabel: string
  onSave: (criteria: Criterion[]) => void
  onCancel?: () => void
}

export function ScorecardBuilder({ initial, saveLabel, onSave, onCancel }: ScorecardBuilderProps) {
  const [criteria, setCriteria] = useState<Criterion[]>(initial.length > 0 ? initial : [blankCriterion()])
  const [saved, setSaved] = useState(false)
  const valid = criteria.some((criterion) => criterion.name.trim().length > 0)

  function update(id: string, changes: Partial<Criterion>) {
    setSaved(false)
    setCriteria((current) => current.map((criterion) => (criterion.id === id ? { ...criterion, ...changes } : criterion)))
  }

  return (
    <div className="builder">
      <ul className="builder__list">
        {criteria.map((criterion, index) => (
          <li key={criterion.id} className="builder__row">
            <input
              className="input"
              aria-label={`Criterion ${index + 1} name`}
              placeholder="For example, Problem solving"
              value={criterion.name}
              onChange={(event) => update(criterion.id, { name: event.target.value })}
            />
            <input
              className="input builder__max"
              type="number"
              min={1}
              max={100}
              aria-label={`Criterion ${index + 1} highest score`}
              value={criterion.max_score}
              onChange={(event) => update(criterion.id, { max_score: Math.max(1, Math.min(100, Number(event.target.value) || 1)) })}
            />
            <button
              type="button"
              className="icon-button icon-button--small"
              aria-label={`Delete criterion ${index + 1}`}
              disabled={criteria.length === 1}
              onClick={() => {
                setSaved(false)
                setCriteria((current) => current.filter((item) => item.id !== criterion.id))
              }}
            >
              <Trash2 />
            </button>
          </li>
        ))}
      </ul>
      <Button
        size="sm"
        variant="secondary"
        icon={<Plus />}
        onClick={() => {
          setSaved(false)
          setCriteria((current) => [...current, blankCriterion()])
        }}
      >
        Add criterion
      </Button>
      <div className="builder__actions">
        {saved && <span className="saved-note">Saved</span>}
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          disabled={!valid}
          onClick={() => {
            onSave(criteria.map((criterion) => ({ ...criterion, name: criterion.name.trim() })).filter((criterion) => criterion.name.length > 0))
            setSaved(true)
          }}
        >
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}

interface BreakdownProps {
  interviewerIds: string[]
  cards: Scorecard[]
  entryFor: (interviewerId: string) => InterviewScore | undefined
}

export function ScoreBreakdown({ interviewerIds, cards, entryFor }: BreakdownProps) {
  return (
    <div className="score-breakdown">
      {interviewerIds.map((id) => {
        const entry = entryFor(id)
        const card = cards.find((item) => item.id === entry?.scorecard_id)
        return (
          <section key={id} className="score-breakdown__item">
            <h4>{personById(id)?.name ?? id}</h4>
            {!entry || !card ? (
              <p className="cell-secondary">Has not scored this candidate.</p>
            ) : (
              <>
                <p className="cell-secondary">{cardLabel(card)}</p>
                <ul>
                  {card.criteria.map((criterion) => (
                    <li key={criterion.id}>
                      <span>{criterion.name}</span>
                      <span>
                        {typeof entry.values[criterion.id] === 'number' ? entry.values[criterion.id] : '—'} / {criterion.max_score}
                      </span>
                    </li>
                  ))}
                </ul>
                {entry.notes && <p className="cell-secondary">“{entry.notes}”</p>}
              </>
            )}
          </section>
        )
      })}
    </div>
  )
}
