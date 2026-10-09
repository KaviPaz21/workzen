import { ArrowRight, Check, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Modal } from '@/components/ui/Modal'
import { Tabs } from '@/components/ui/Tabs'
import { cleanBuckets } from '../data/buckets'
import type { JobDescription } from '../types'
import { jdStateOf, useStore } from '../state/RecruiteOneStore'
import { BucketEditor } from './BucketEditor'
import { JdMetaFields } from './JdMetaFields'
import { JdStatusBadge } from './StatusBadges'
import { WeightEditor } from './WeightEditor'

type Tab = 'requirements' | 'weights'

interface JdDetailModalProps {
  jd: JobDescription | null
  onClose: () => void
  onProceed: (jd: JobDescription) => void
}

function JdDetailForm({ jd, onClose, onProceed }: { jd: JobDescription; onClose: () => void; onProceed: (jd: JobDescription) => void }) {
  const { updateJd, deleteJd, restoreJd, vacancies } = useStore()
  const [tab, setTab] = useState<Tab>('requirements')
  const [name, setName] = useState(jd.name)
  const [role, setRole] = useState(jd.role)
  const [sector, setSector] = useState(jd.sector)
  const [level, setLevel] = useState(jd.level)
  const [buckets, setBuckets] = useState(jd.buckets)
  const [weights, setWeights] = useState(jd.weights)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function currentValues() {
    return { name: name.trim(), role: role.trim(), sector: sector.trim(), level, buckets: cleanBuckets(buckets), weights }
  }

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
        ) : (
          <WeightEditor
            weights={weights}
            buckets={buckets}
            onChange={(next) => {
              setWeights(next)
              setSaved(false)
            }}
          />
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
