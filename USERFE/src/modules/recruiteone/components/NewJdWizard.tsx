import { Check, LoaderCircle, Sparkles, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cleanBuckets, defaultWeights, emptyBuckets } from '../data/buckets'
import { decomposeJd } from '../services/jdApi'
import type { JobDescription, Level } from '../types'
import type { NewJd } from '../state/RecruiteOneStore'
import { BucketEditor } from './BucketEditor'
import { JdMetaFields } from './JdMetaFields'
import { WeightEditor } from './WeightEditor'

type Step = 'input' | 'review' | 'weights'

const steps: { value: Step; label: string }[] = [
  { value: 'input', label: 'Add JD' },
  { value: 'review', label: 'Review requirements' },
  { value: 'weights', label: 'Set weights' },
]

interface NewJdWizardProps {
  open: boolean
  onClose: () => void
  onSave: (input: NewJd) => JobDescription
  onSaved: (jd: JobDescription) => void
}

export function NewJdWizard({ open, onClose, onSave, onSaved }: NewJdWizardProps) {
  const [step, setStep] = useState<Step>('input')
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [analysing, setAnalysing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysed, setAnalysed] = useState(false)
  const [role, setRole] = useState('')
  const [sector, setSector] = useState('')
  const [level, setLevel] = useState<Level>('mid')
  const [buckets, setBuckets] = useState(emptyBuckets())
  const [weights, setWeights] = useState(defaultWeights())

  const stepIndex = steps.findIndex((item) => item.value === step)

  async function submitText() {
    setAnalysing(true)
    setError(null)
    try {
      const result = await decomposeJd(name.trim(), text.trim())
      setRole(result.role)
      setSector(result.sector)
      setLevel(result.level)
      setBuckets(result.buckets)
      setWeights(defaultWeights())
      setAnalysed(true)
      setStep('review')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The AI analysis failed. Please try again.')
    } finally {
      setAnalysing(false)
    }
  }

  function save() {
    const created = onSave({
      name: name.trim(),
      role: role.trim(),
      sector: sector.trim(),
      level,
      raw_text: text.trim(),
      buckets: cleanBuckets(buckets),
      weights,
    })
    onSaved(created)
  }

  const canSubmit = name.trim().length > 0 && text.trim().length > 0 && !analysing

  let footer
  if (step === 'input') {
    footer = (
      <>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          icon={analysing ? <LoaderCircle className="spin" /> : <Sparkles />}
          disabled={!canSubmit}
          onClick={submitText}
        >
          {analysing ? 'Analysing with AI…' : 'Submit'}
        </Button>
      </>
    )
  } else if (step === 'review') {
    footer = (
      <>
        <Button variant="secondary" onClick={() => setStep('input')}>
          Back
        </Button>
        <Button disabled={role.trim().length === 0} onClick={() => setStep('weights')}>
          Next: set weights
        </Button>
      </>
    )
  } else {
    footer = (
      <>
        <Button variant="secondary" onClick={() => setStep('review')}>
          Back
        </Button>
        <Button icon={<Check />} onClick={save}>
          Save JD
        </Button>
      </>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New job description"
      description={
        step === 'input'
          ? 'Paste the JD as plain text. AI will break it into requirements you can edit.'
          : step === 'review'
            ? 'Check what AI found. Edit, add or delete any item.'
            : 'Choose how much each category should count during evaluation.'
      }
      closeOnBackdrop={false}
      footer={footer}
    >
      <ol className="stepper" aria-label="Progress">
        {steps.map((item, index) => (
          <li
            key={item.value}
            className={`stepper__item${index === stepIndex ? ' stepper__item--current' : ''}${index < stepIndex ? ' stepper__item--done' : ''}`}
            aria-current={index === stepIndex ? 'step' : undefined}
          >
            <span className="stepper__number">{index < stepIndex ? <Check aria-hidden="true" /> : index + 1}</span>
            {item.label}
          </li>
        ))}
      </ol>

      {step === 'input' && (
        <div className="form-stack">
          <label className="field">
            <span className="field__label">JD name</span>
            <input
              className="input"
              value={name}
              placeholder="For example, Senior Backend Engineer"
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </label>
          <label className="field">
            <span className="field__label">Job description</span>
            <textarea
              className="textarea"
              rows={10}
              value={text}
              placeholder="Paste the full job description here as plain text"
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          {analysed && <p className="field__hint">Submitting again will replace the requirements you edited.</p>}
          {error && (
            <div className="notice notice--danger" role="alert">
              <TriangleAlert aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {step === 'review' && (
        <div className="form-stack">
          <JdMetaFields
            role={role}
            sector={sector}
            level={level}
            onChange={(changes) => {
              if (changes.role !== undefined) setRole(changes.role)
              if (changes.sector !== undefined) setSector(changes.sector)
              if (changes.level !== undefined) setLevel(changes.level)
            }}
          />
          <BucketEditor buckets={buckets} onChange={setBuckets} />
        </div>
      )}

      {step === 'weights' && <WeightEditor weights={weights} buckets={buckets} onChange={setWeights} />}
    </Modal>
  )
}
