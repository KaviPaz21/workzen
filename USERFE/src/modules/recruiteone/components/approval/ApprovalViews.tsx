import { Check, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { formatDate, formatDateTime, titleCase } from '@/lib/format'
import { decisionMeta, stepDefinition } from '../../data/approvals'
import { personById } from '../../data/people'
import { approvalStateOf, currentStepIndex, stepOwnerLabel, vacanciesOfApproval } from '../../services/approvalMath'
import { useStore } from '../../state/RecruiteOneStore'
import type { HiringApproval } from '../../types'
import { ApprovalStateBadge, VacancyStatusBadge } from '../StatusBadges'

export function ApprovalRequestDetails({ approval }: { approval: HiringApproval }) {
  const { jds, vacancies } = useStore()
  const state = approvalStateOf(approval, vacancies)
  const linkedJds = jds.filter((jd) => jd.approval_id === approval.id)
  const linkedVacancies = vacanciesOfApproval(approval.id, vacancies)
  const creator = personById(approval.created_by)

  return (
    <div className="form-stack">
      <dl className="detail-list detail-list--grid">
        <div>
          <dt>Status</dt>
          <dd>
            <ApprovalStateBadge state={state} />
          </dd>
        </div>
        <div>
          <dt>Department</dt>
          <dd>{approval.department}</dd>
        </div>
        <div>
          <dt>Level</dt>
          <dd>{titleCase(approval.level)}</dd>
        </div>
        <div>
          <dt>Recruiter</dt>
          <dd>{approval.recruiter_name}</dd>
        </div>
        <div>
          <dt>Requested by</dt>
          <dd>{creator?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>{approval.submitted_at ? 'Submitted' : 'Created'}</dt>
          <dd>{formatDate(approval.submitted_at ?? approval.created_at)}</dd>
        </div>
      </dl>

      <section className="approval-text">
        <h3 className="mini-heading">Job description details</h3>
        <p>{approval.jd_details}</p>
      </section>
      <section className="approval-text">
        <h3 className="mini-heading">Why this position is required</h3>
        <p>{approval.reason}</p>
      </section>
      <section className="approval-text">
        <h3 className="mini-heading">Value of this position</h3>
        <p>{approval.position_value}</p>
      </section>

      <section className="approval-text">
        <h3 className="mini-heading">Used by</h3>
        {linkedJds.length === 0 && linkedVacancies.length === 0 ? (
          <p className="wizard__muted">Not linked to a job description or vacancy yet.</p>
        ) : (
          <ul className="approval-links">
            {linkedJds.map((jd) => (
              <li key={jd.id}>
                <span className="cell-primary">{jd.name}</span>
                <span className="cell-secondary">Job description</span>
              </li>
            ))}
            {linkedVacancies.map((vacancy) => (
              <li key={vacancy.id}>
                <span className="cell-primary">{vacancy.title}</span>
                <span className="approval-links__meta">
                  <span className="cell-secondary">Vacancy</span>
                  <VacancyStatusBadge status={vacancy.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function waitingLabel(approval: HiringApproval) {
  if (approval.status === 'draft') return 'Not submitted'
  if (approval.status === 'rejected') return 'Not reached'
  return 'Waiting'
}

export function ApprovalFlow({ approval }: { approval: HiringApproval }) {
  const current = currentStepIndex(approval)

  return (
    <ol className="approval-flow">
      {approval.steps.map((step, index) => {
        const definition = stepDefinition(step.key)
        const decider = step.decided_by ? personById(step.decided_by) : undefined
        const isCurrent = index === current
        const status = isCurrent ? 'Awaiting decision' : step.decision === 'pending' ? waitingLabel(approval) : decisionMeta[step.decision].label
        return (
          <li key={step.key} className={`approval-step approval-step--${step.decision}${isCurrent ? ' approval-step--current' : ''}`}>
            <span className="approval-step__marker" aria-hidden="true">
              {step.decision === 'approved' ? <Check /> : step.decision === 'rejected' ? <X /> : index + 1}
            </span>
            <div className="approval-step__body">
              <div className="approval-step__head">
                <p className="cell-primary">{definition.label}</p>
                {step.decision === 'pending' ? <Badge tone={isCurrent ? 'warning' : 'neutral'}>{status}</Badge> : <Badge tone={decisionMeta[step.decision].tone}>{status}</Badge>}
              </div>
              <p className="cell-secondary">{stepOwnerLabel(step)}</p>
              {step.decided_at && (
                <p className="approval-step__decision">
                  {step.decision === 'approved' ? 'Approved' : 'Rejected'} by {decider?.name ?? 'someone'} on {formatDateTime(step.decided_at)}
                </p>
              )}
              {step.comment && <p className="approval-step__comment">“{step.comment}”</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function ApprovalOverview({ approval }: { approval: HiringApproval }) {
  return (
    <div className="form-stack">
      <ApprovalRequestDetails approval={approval} />
      <div>
        <h3 className="mini-heading">Approval flow</h3>
        <ApprovalFlow approval={approval} />
      </div>
    </div>
  )
}
