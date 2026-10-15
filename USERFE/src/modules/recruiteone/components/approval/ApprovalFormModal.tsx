import { Check, Save, Send } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { levelOptions } from '../../data/buckets'
import { stepDefinitions } from '../../data/approvals'
import { defaultHeadOf, departmentNames, peopleIn } from '../../data/people'
import { isApprovalComplete } from '../../services/approvalMath'
import { useCurrentUser } from '../../state/CurrentUser'
import { useStore } from '../../state/RecruiteOneStore'
import type { HiringApproval, Level } from '../../types'

type Step = 'request' | 'approvers'

const steps: { value: Step; label: string }[] = [
  { value: 'request', label: 'Hiring request' },
  { value: 'approvers', label: 'Approvers' },
]

interface ApprovalFormModalProps {
  approval?: HiringApproval | null
  onClose: () => void
}

export function ApprovalFormModal({ approval = null, onClose }: ApprovalFormModalProps) {
  const { addApproval, updateApproval } = useStore()
  const { user } = useCurrentUser()
  const [step, setStep] = useState<Step>('request')
  const [positionName, setPositionName] = useState(approval?.position_name ?? '')
  const [recruiterName, setRecruiterName] = useState(approval?.recruiter_name ?? user.name)
  const [level, setLevel] = useState<Level>(approval?.level ?? 'mid')
  const [department, setDepartment] = useState(approval?.department ?? '')
  const [jdDetails, setJdDetails] = useState(approval?.jd_details ?? '')
  const [reason, setReason] = useState(approval?.reason ?? '')
  const [positionValue, setPositionValue] = useState(approval?.position_value ?? '')
  const [chosenHeadId, setChosenHeadId] = useState(approval?.steps[0]?.approver_id ?? '')

  const heads = peopleIn(department)
  const headId = heads.some((person) => person.id === chosenHeadId) ? chosenHeadId : (defaultHeadOf(department)?.id ?? '')
  const stepIndex = steps.findIndex((item) => item.value === step)
  const requestFields = {
    position_name: positionName,
    recruiter_name: recruiterName,
    department,
    jd_details: jdDetails,
    reason,
    position_value: positionValue,
  }
  const requestComplete = isApprovalComplete(requestFields)
  const canSubmit = requestComplete && headId !== ''
  const canSaveDraft = positionName.trim() !== '' && department !== '' && headId !== ''

  function save(submit: boolean) {
    const input = {
      position_name: positionName,
      recruiter_name: recruiterName,
      level,
      department,
      jd_details: jdDetails,
      reason,
      position_value: positionValue,
      head_id: headId,
      created_by: approval?.created_by ?? user.id,
    }
    if (approval) updateApproval(approval.id, input, submit)
    else addApproval(input, submit)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={approval ? 'Edit hiring request' : 'New hiring request'}
      description={
        step === 'request'
          ? 'Describe the position, why it is needed and what it is worth to the company.'
          : 'The request goes to each approver in turn. Only the department head is chosen by you.'
      }
      closeOnBackdrop={false}
      footer={
        <>
          {step === 'request' ? (
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setStep('request')}>
              Back
            </Button>
          )}
          <span className="modal__footer-spacer" />
          <Button variant="secondary" icon={<Save />} disabled={!canSaveDraft} onClick={() => save(false)}>
            Save as draft
          </Button>
          {step === 'request' ? (
            <Button disabled={!requestComplete} onClick={() => setStep('approvers')}>
              Next: approvers
            </Button>
          ) : (
            <Button icon={<Send />} disabled={!canSubmit} onClick={() => save(true)}>
              Submit for approval
            </Button>
          )}
        </>
      }
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

      {step === 'request' && (
        <div className="form-stack">
          <label className="field">
            <span className="field__label">Position name</span>
            <input
              className="input"
              value={positionName}
              placeholder="For example, Senior Backend Engineer"
              onChange={(event) => setPositionName(event.target.value)}
              autoFocus
            />
          </label>
          <div className="meta-fields">
            <label className="field">
              <span className="field__label">Recruiter name</span>
              <input className="input" value={recruiterName} onChange={(event) => setRecruiterName(event.target.value)} />
            </label>
            <label className="field">
              <span className="field__label">Level</span>
              <select className="select select--full" value={level} onChange={(event) => setLevel(event.target.value as Level)}>
                {levelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Department</span>
              <select className="select select--full" value={department} onChange={(event) => setDepartment(event.target.value)}>
                <option value="">Select a department</option>
                {departmentNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span className="field__label">Job description details</span>
            <textarea
              className="textarea"
              rows={4}
              value={jdDetails}
              placeholder="What the person will do, the main skills and the experience you expect"
              onChange={(event) => setJdDetails(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Why is this position required?</span>
            <textarea
              className="textarea"
              rows={3}
              value={reason}
              placeholder="For example, growth of the team, a resignation or a new project"
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Value of this position</span>
            <textarea
              className="textarea"
              rows={3}
              value={positionValue}
              placeholder="What this hire brings to the company, such as revenue, savings or delivery speed"
              onChange={(event) => setPositionValue(event.target.value)}
            />
          </label>
        </div>
      )}

      {step === 'approvers' && (
        <div className="form-stack">
          <ol className="approval-flow">
            {stepDefinitions.map((definition, index) => (
              <li key={definition.key} className="approval-step approval-step--pending">
                <span className="approval-step__marker" aria-hidden="true">
                  {index + 1}
                </span>
                <div className="approval-step__body">
                  <p className="cell-primary">{definition.label}</p>
                  {definition.key === 'department_head' ? (
                    <label className="field">
                      <span className="field__label">Head of {department || 'the department'}</span>
                      <select className="select select--full" value={headId} onChange={(event) => setChosenHeadId(event.target.value)}>
                        {heads.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.name} · {person.role}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <p className="cell-secondary">
                      Anyone in {definition.department}:{' '}
                      {peopleIn(definition.department ?? '')
                        .map((person) => person.name)
                        .join(', ')}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <p className="field__hint">When every step is approved the request becomes an approved hiring. A job description can then be linked to it and a vacancy can be opened.</p>
        </div>
      )}
    </Modal>
  )
}
