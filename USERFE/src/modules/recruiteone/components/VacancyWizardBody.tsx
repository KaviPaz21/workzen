import { CalendarDays, Check, GitBranch, Link2, Search, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formatDate, titleCase } from '@/lib/format'
import { isPipelineValid, emptyPipeline, PipelineEditor } from './PipelineEditor'
import { ShareLink } from './ShareLink'
import { Link } from 'react-router-dom'
import { approvalReference, usableForVacancy } from '../services/approvalMath'
import { newShareToken, todayIso, useStore, type NewVacancy } from '../state/RecruiteOneStore'
import type { JobDescription, Pipeline, Vacancy } from '../types'
import { ApprovalPicker } from './approval/ApprovalPicker'

type Step = 'details' | 'options' | 'done'

interface VacancyWizardBodyProps {
  jds: JobDescription[]
  lockedJd?: JobDescription | null
  onCreate: (input: NewVacancy) => Vacancy
  onUploadNow: (vacancy: Vacancy) => void
  onDone: () => void
  onCancel: () => void
}

export function VacancyWizardBody({ jds, lockedJd = null, onCreate, onUploadNow, onDone, onCancel }: VacancyWizardBodyProps) {
  const { approvals, vacancies } = useStore()
  const available = approvals.filter((approval) => usableForVacancy(approval, vacancies))
  const linkedDefault = (jd: JobDescription | null | undefined) => available.find((approval) => approval.id === jd?.approval_id)

  const [step, setStep] = useState<Step>('details')
  const [title, setTitle] = useState('')
  const [jdId, setJdId] = useState(lockedJd?.id ?? '')
  const [approvalId, setApprovalId] = useState(linkedDefault(lockedJd)?.id ?? '')
  const [query, setQuery] = useState('')
  const [shareable, setShareable] = useState(false)
  const [closingDate, setClosingDate] = useState('')
  const [token] = useState(newShareToken)
  const [pipelineOn, setPipelineOn] = useState(false)
  const [pipeline, setPipeline] = useState<Pipeline>(emptyPipeline)
  const [pipelineConfirmed, setPipelineConfirmed] = useState(false)
  const [created, setCreated] = useState<Vacancy | null>(null)

  const selectedJd = lockedJd ?? jds.find((jd) => jd.id === jdId) ?? null
  const selectedApproval = available.find((approval) => approval.id === approvalId) ?? null

  function chooseJd(jd: JobDescription) {
    setJdId(jd.id)
    const approval = linkedDefault(jd)
    if (approval) chooseApproval(approval.id)
  }

  function chooseApproval(id: string) {
    setApprovalId(id)
    const approval = available.find((item) => item.id === id)
    if (approval && title.trim() === '') setTitle(approval.position_name)
  }

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase()
    return jds.filter(
      (jd) => term === '' || jd.name.toLowerCase().includes(term) || jd.role.toLowerCase().includes(term) || jd.sector.toLowerCase().includes(term),
    )
  }, [jds, query])

  const canContinue = title.trim().length > 0 && selectedJd !== null && selectedApproval !== null
  const canSave = (!shareable || closingDate !== '') && (!pipelineOn || pipelineConfirmed)

  function save() {
    if (!selectedJd || !selectedApproval) return
    const vacancy = onCreate({
      title: title.trim(),
      jd: selectedJd,
      approval: selectedApproval,
      closing_date: shareable ? closingDate : null,
      shareable,
      share_token: shareable ? token : undefined,
      pipeline: pipelineOn ? pipeline : null,
    })
    setCreated(vacancy)
    setStep('done')
  }

  if (step === 'done' && created) {
    const createdApproval = approvals.find((approval) => approval.id === created.approval_id)
    return (
      <div className="wizard">
        <div className="wizard__done">
          <span className="wizard__done-icon" aria-hidden="true">
            <Check />
          </span>
          <h3>Vacancy created</h3>
          <p className="wizard__muted">
            <strong>{created.title}</strong> is open and linked to {selectedJd?.name}.
          </p>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Hiring approval</dt>
            <dd>{createdApproval ? `${createdApproval.position_name} · ${approvalReference(createdApproval)}` : '—'}</dd>
          </div>
          <div>
            <dt>Closing date</dt>
            <dd>{formatDate(created.closing_date)}</dd>
          </div>
          <div>
            <dt>Pipeline</dt>
            <dd>{created.pipeline ? `${created.pipeline.name} · ${created.pipeline.stages.length} stages` : 'Not scheduled'}</dd>
          </div>
        </dl>
        {created.share_token && (
          <div className="wizard__section">
            <p className="mini-heading">Shareable application link</p>
            <ShareLink token={created.share_token} />
          </div>
        )}
        <div className="wizard__actions">
          <Button variant="secondary" onClick={onDone}>
            Done
          </Button>
          <Button icon={<Upload />} onClick={() => onUploadNow(created)}>
            Upload CVs now
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="wizard">
      <ol className="stepper" aria-label="Progress">
        <li className={`stepper__item${step === 'details' ? ' stepper__item--current' : ' stepper__item--done'}`} aria-current={step === 'details' ? 'step' : undefined}>
          <span className="stepper__number">{step === 'details' ? 1 : <Check aria-hidden="true" />}</span>
          Details
        </li>
        <li className={`stepper__item${step === 'options' ? ' stepper__item--current' : ''}`} aria-current={step === 'options' ? 'step' : undefined}>
          <span className="stepper__number">2</span>
          Options
        </li>
      </ol>

      {step === 'details' && (
        <div className="form-stack">
          <label className="field">
            <span className="field__label">Vacancy name</span>
            <input
              className="input"
              value={title}
              placeholder="For example, Senior Backend Engineer, Colombo"
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
            />
          </label>

          {lockedJd ? (
            <div className="field">
              <span className="field__label">Job description</span>
              <div className="jd-locked">
                <span className="cell-primary">{lockedJd.name}</span>
                <span className="cell-secondary">
                  {lockedJd.role} · {lockedJd.sector} · {titleCase(lockedJd.level)}
                </span>
              </div>
            </div>
          ) : (
            <div className="field">
              <span className="field__label" id="jd-picker-label">
                Job description
              </span>
              <label className="search-field jd-search">
                <span className="sr-only">Search job descriptions</span>
                <Search aria-hidden="true" />
                <input type="search" placeholder="Search active job descriptions" value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <ul className="jd-options" role="radiogroup" aria-labelledby="jd-picker-label">
                {shown.map((jd) => (
                  <li key={jd.id}>
                    <label className={`jd-option${jd.id === jdId ? ' jd-option--selected' : ''}`}>
                      <input type="radio" name="jd" className="radio" checked={jd.id === jdId} onChange={() => chooseJd(jd)} />
                      <span className="jd-option__text">
                        <span className="cell-primary">{jd.name}</span>
                        <span className="cell-secondary">
                          {jd.role} · {jd.sector}
                        </span>
                      </span>
                      <span className="chip">{titleCase(jd.level)}</span>
                    </label>
                  </li>
                ))}
                {shown.length === 0 && <li className="picker__empty">No active job description matches your search.</li>}
              </ul>
            </div>
          )}

          <div className="field approval-field">
            <span className="field__label">Hiring approval</span>
            <span className="approval-field__required">Required. Only approved hiring requests that are not used by another vacancy can be linked.</span>
            <ApprovalPicker
              label="Hiring approval for this vacancy"
              approvals={available}
              value={approvalId}
              onChange={chooseApproval}
              emptyMessage={
                <span>
                  No approved hiring request is available. Create one and get it approved under <Link to="/hr/recruiteone/approvals">Approvals</Link> first.
                </span>
              }
            />
          </div>
        </div>
      )}

      {step === 'options' && (
        <div className="form-stack">
          <p className="wizard__muted">Both options are optional. You can switch either on, both, or neither and save the vacancy as it is.</p>

          <section className={`option${shareable ? ' option--on' : ''}`}>
            <label className="option__head">
              <input type="checkbox" className="checkbox" checked={shareable} onChange={(event) => setShareable(event.target.checked)} />
              <span className="option__icon" aria-hidden="true">
                <Link2 />
              </span>
              <span className="option__text">
                <span className="cell-primary">Shareable link</span>
                <span className="cell-secondary">Candidates apply through a public link until the closing date.</span>
              </span>
            </label>
            {shareable && (
              <div className="option__body">
                <label className="field">
                  <span className="field__label">Closing date</span>
                  <span className="date-field">
                    <CalendarDays aria-hidden="true" />
                    <input className="input" type="date" min={todayIso()} value={closingDate} onChange={(event) => setClosingDate(event.target.value)} />
                  </span>
                </label>
                {closingDate ? (
                  <div className="field">
                    <span className="field__label">Application link</span>
                    <ShareLink token={token} />
                  </div>
                ) : (
                  <p className="field__hint">Pick a closing date to generate the link.</p>
                )}
              </div>
            )}
          </section>

          <section className={`option${pipelineOn ? ' option--on' : ''}`}>
            <label className="option__head">
              <input
                type="checkbox"
                className="checkbox"
                checked={pipelineOn}
                onChange={(event) => {
                  setPipelineOn(event.target.checked)
                  if (!event.target.checked) setPipelineConfirmed(false)
                }}
              />
              <span className="option__icon" aria-hidden="true">
                <GitBranch />
              </span>
              <span className="option__text">
                <span className="cell-primary">Schedule pipeline</span>
                <span className="cell-secondary">Define interview stages, capacity and interviewers. HR is added by default.</span>
              </span>
            </label>
            {pipelineOn && (
              <div className="option__body">
                {pipelineConfirmed ? (
                  <div className="pipeline-summary">
                    <div>
                      <p className="cell-primary">{pipeline.name}</p>
                      <p className="cell-secondary">
                        {pipeline.stages.map((stage) => stage.name).join(' → ')}
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setPipelineConfirmed(false)}>
                      Edit
                    </Button>
                  </div>
                ) : (
                  <>
                    <PipelineEditor value={pipeline} onChange={setPipeline} />
                    <div className="option__confirm">
                      <Button disabled={!isPipelineValid(pipeline)} onClick={() => setPipelineConfirmed(true)}>
                        Confirm pipeline
                      </Button>
                      {!isPipelineValid(pipeline) && (
                        <span className="field__hint">Add a pipeline name and give every stage a name and at least one interviewer.</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      <div className="wizard__actions">
        {step === 'details' ? (
          <>
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button disabled={!canContinue} onClick={() => setStep('options')}>
              Next
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setStep('details')}>
              Back
            </Button>
            <Button icon={<Check />} disabled={!canSave} onClick={save}>
              Save vacancy
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
