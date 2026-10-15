import { Check, Pencil, Send, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Modal } from '@/components/ui/Modal'
import { Tabs } from '@/components/ui/Tabs'
import { approvalReference, approvalStateOf, canDecide, currentStepIndex, vacanciesOfApproval } from '../../services/approvalMath'
import { approvalStateMeta, stepDefinition } from '../../data/approvals'
import { useCurrentUser } from '../../state/CurrentUser'
import { useStore, type NewApproval } from '../../state/RecruiteOneStore'
import type { HiringApproval } from '../../types'
import { ApprovalFlow, ApprovalRequestDetails } from './ApprovalViews'

type Tab = 'request' | 'flow'

interface ApprovalDetailModalProps {
  approvalId: string
  onClose: () => void
  onEdit?: (approval: HiringApproval) => void
}

export function approvalToInput(approval: HiringApproval): NewApproval {
  return {
    position_name: approval.position_name,
    recruiter_name: approval.recruiter_name,
    level: approval.level,
    department: approval.department,
    jd_details: approval.jd_details,
    reason: approval.reason,
    position_value: approval.position_value,
    head_id: approval.steps[0]?.approver_id ?? '',
    created_by: approval.created_by,
  }
}

function ApprovalDetailBody({ approval, onClose, onEdit }: { approval: HiringApproval; onClose: () => void; onEdit?: (approval: HiringApproval) => void }) {
  const { vacancies, jds, decideApproval, updateApproval, deleteApproval } = useStore()
  const { user } = useCurrentUser()
  const mayDecide = canDecide(approval, user)
  const [tab, setTab] = useState<Tab>(mayDecide ? 'flow' : 'request')
  const [comment, setComment] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const state = approvalStateOf(approval, vacancies)
  const stepIndex = currentStepIndex(approval)
  const stepLabel = stepIndex >= 0 ? stepDefinition(approval.steps[stepIndex].key).label : ''
  const inUse = jds.some((jd) => jd.approval_id === approval.id) || vacanciesOfApproval(approval.id, vacancies).length > 0
  const isDraft = approval.status === 'draft'

  function decide(decision: 'approved' | 'rejected') {
    decideApproval(approval.id, decision, user, comment)
    setComment('')
    setTab('flow')
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={approval.position_name}
      description={`${approvalReference(approval)} · ${approval.department} · ${approvalStateMeta[state].label}`}
      closeOnBackdrop={false}
      footer={
        <>
          {isDraft && !inUse && (
            <Button variant="danger" icon={<Trash2 />} onClick={() => setConfirmDelete(true)}>
              Delete draft
            </Button>
          )}
          <span className="modal__footer-spacer" />
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {isDraft && onEdit && (
            <Button variant="secondary" icon={<Pencil />} onClick={() => onEdit(approval)}>
              Edit
            </Button>
          )}
          {isDraft && (
            <Button
              icon={<Send />}
              onClick={() => {
                updateApproval(approval.id, approvalToInput(approval), true)
                setTab('flow')
              }}
            >
              Submit for approval
            </Button>
          )}
        </>
      }
    >
      <Tabs
        label="Approval sections"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'request', label: 'Request' },
          { value: 'flow', label: 'Approval flow' },
        ]}
      >
        {tab === 'request' && <ApprovalRequestDetails approval={approval} />}
        {tab === 'flow' && (
          <div className="form-stack">
            {mayDecide && (
              <section className="decision-panel" aria-label="Your decision">
                <p className="cell-primary">Your decision: {stepLabel}</p>
                <p className="cell-secondary">Add a comment for the requester. A comment is required to reject.</p>
                <textarea
                  className="textarea"
                  rows={3}
                  value={comment}
                  placeholder="Comment (optional when approving)"
                  onChange={(event) => setComment(event.target.value)}
                />
                <div className="decision-panel__actions">
                  <Button variant="secondary" icon={<X />} disabled={comment.trim() === ''} onClick={() => decide('rejected')}>
                    Reject
                  </Button>
                  <Button icon={<Check />} onClick={() => decide('approved')}>
                    Approve
                  </Button>
                </div>
              </section>
            )}
            {approval.status === 'draft' && <p className="wizard__muted">This request has not been submitted. Submit it to start the approval flow.</p>}
            <ApprovalFlow approval={approval} />
          </div>
        )}
      </Tabs>

      <ConfirmModal
        open={confirmDelete}
        title="Delete this draft?"
        message="The draft request is removed for good."
        confirmLabel="Delete draft"
        cancelLabel="Keep it"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteApproval(approval.id)
          setConfirmDelete(false)
          onClose()
        }}
      />
    </Modal>
  )
}

export function ApprovalDetailModal({ approvalId, onClose, onEdit }: ApprovalDetailModalProps) {
  const { approvals } = useStore()
  const approval = approvals.find((item) => item.id === approvalId)
  if (!approval) return null
  return <ApprovalDetailBody key={approval.id} approval={approval} onClose={onClose} onEdit={onEdit} />
}
