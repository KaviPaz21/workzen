import { ArrowRight, Check, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Modal } from '@/components/ui/Modal'
import { Tabs } from '@/components/ui/Tabs'
import { cleanBuckets } from '../data/buckets'
import { usableForJd } from '../services/approvalMath'
import type { HiringApproval, JobDescription, Vacancy } from '../types'
import { jdStateOf, useStore } from '../state/RecruiteOneStore'
import { ApprovalLink } from './approval/ApprovalLink'
import { ApprovalPicker } from './approval/ApprovalPicker'
import { BucketEditor } from './BucketEditor'
import { JdMetaFields } from './JdMetaFields'
import { JdStatusBadge } from './StatusBadges'
import { WeightEditor } from './WeightEditor'

type Tab = 'requirements' | 'weights' | 'approval'

interface JdDetailModalProps {
  jd: JobDescription | null
  onClose: () => void
  onProceed: (jd: JobDescription) => void
}

function JdDetailForm({ jd, onClose, onProceed }: { jd: JobDescription; onClose: () => void; onProceed: (jd: JobDescription) => void }) {
  const { updateJd, deleteJd, restoreJd, vacancies, approvals } = useStore()
  const [tab, setTab] = useState<Tab>('requirements')
  const [approvalId, setApprovalId] = useState(jd.approval_id ?? '')
  const [name, setName] = useState(jd.name)
  const [role, setRole] = useState(jd.role)
  const [sector, setSector] = useState(jd.sector)
  const [level, setLevel] = useState(jd.level)
  const [buckets, setBuckets] = useState(jd.buckets)
  const [weights, setWeights] = useState(jd.weights)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function currentValues() {
    return { name: name.trim(), role: role.trim(), sector: sector.trim(), level, buckets: cleanBuckets(buckets), weights, approval_id: approvalId === '' ? null : approvalId }
  }

  const linkable = approvals.filter((approval) => approval.id === approvalId || usableForJd(approval, vacancies))
  const vacancyApprovals = vacancies
    .filter((vacancy) => vacancy.jd_id === jd.id && vacancy.approval_id)
    .map((vacancy) => ({ vacancy, approval: approvals.find((approval) => approval.id === vacancy.approval_id) }))
    .filter((entry): entry is { vacancy: Vacancy; approval: HiringApproval } => entry.approval !== undefined)

  function save() {
    updateJd(jd.id, currentValues())
    setSaved(true)
  }

  function proceed() {
    updateJd(jd.id, currentValues())
    onProceed({ ...jd, ...currentValues() })
  }

  const state = jdStateOf(jd, vacancies)

  return (
    <Modal
      open
      onClose={onClose}
      title={jd.name}
      description={`${jd.role} · ${jd.sector}`}
      closeOnBackdrop={false}
      footer={
        <>
          {jd.deleted ? (
            <Button
              variant="secondary"
              icon={<RotateCcw />}
              onClick={() => {
                restoreJd(jd.id)
                onClose()
              }}
            >
              Restore
            </Button>
          ) : (
            <Button variant="danger" icon={<Trash2 />} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
          <span className="modal__footer-spacer" aria-live="polite">
            {saved && (
              <span className="saved-note">
                <Check aria-hidden="true" /> Saved
              </span>
            )}
          </span>
          <Button variant="secondary" onClick={save} disabled={name.trim().length === 0}>
            Save
          </Button>
          <Button icon={<ArrowRight />} disabled={jd.deleted || name.trim().length === 0} onClick={proceed}>
            Proceed to vacancy
          </Button>
        </>
      }
    >
      <div className="detail-status">
        <JdStatusBadge state={state} />
      </div>

      <Tabs
        label="Job description sections"
        value={tab}
        onChange={(value) => {
          setTab(value)
          setSaved(false)
        }}
        options={[
          { value: 'requirements', label: 'Requirements' },
          { value: 'weights', label: 'Weights' },
          { value: 'approval', label: 'Approval' },
        ]}
      >
        {tab === 'requirements' ? (
          <div
            className="form-stack"
            onChange={() => setSaved(false)}
          >
            <label className="field">
              <span className="field__label">JD name</span>
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
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
            <BucketEditor
              buckets={buckets}
              onChange={(next) => {
                setBuckets(next)
                setSaved(false)
              }}
            />
            <details className="original-text">
              <summary>Original JD text</summary>
              <pre>{jd.raw_text}</pre>
            </details>
          </div>
        ) : tab === 'weights' ? (
          <WeightEditor
            weights={weights}
            buckets={buckets}
            onChange={(next) => {
              setWeights(next)
              setSaved(false)
            }}
          />
        ) : (
          <div className="form-stack">
            <div className="approval-field">
              <p className="mini-heading">Hiring approval for this JD</p>
              <p className="approval-field__required">Optional. Link the hiring request this JD was written for, then press Save.</p>
              <ApprovalPicker
                label="Hiring approval for this JD"
                approvals={linkable}
                value={approvalId}
                allowNone
                onChange={(next) => {
                  setApprovalId(next)
                  setSaved(false)
                }}
                emptyMessage="There is no pending or approved hiring request to link yet. Create one under Approvals."
              />
            </div>
            {approvalId !== '' && jd.approval_id === approvalId && (
              <div>
                <p className="mini-heading">Linked approval</p>
                <ApprovalLink approvalId={approvalId} />
              </div>
            )}
            {vacancyApprovals.length > 0 && (
              <div>
                <p className="mini-heading">Approvals used by this JD&apos;s vacancies</p>
                <ul className="approval-links">
                  {vacancyApprovals.map(({ vacancy, approval }) => (
                    <li key={vacancy.id}>
                      <span className="cell-primary">{vacancy.title}</span>
                      <ApprovalLink approvalId={approval.id} size="sm" />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Tabs>

      <ConfirmModal
        open={confirmDelete}
        title={`Delete "${jd.name}"?`}
        message="The JD moves to the Deleted list. You can restore it from there later."
        confirmLabel="Delete JD"
        cancelLabel="Keep it"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteJd(jd.id)
          setConfirmDelete(false)
          onClose()
        }}
      />
    </Modal>
  )
}

export function JdDetailModal({ jd, onClose, onProceed }: JdDetailModalProps) {
  if (!jd) return null
  return <JdDetailForm key={jd.id} jd={jd} onClose={onClose} onProceed={onProceed} />
}
