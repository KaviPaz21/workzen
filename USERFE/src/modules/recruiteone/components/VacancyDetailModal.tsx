import { CircleCheck, RotateCcw, Upload } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { MeterBar } from '@/components/ui/MeterBar'
import { Modal } from '@/components/ui/Modal'
import { Tabs } from '@/components/ui/Tabs'
import { formatDate, titleCase } from '@/lib/format'
import { bucketDefinitions } from '../data/buckets'
import { collectionState, vacancyStage } from '../data/stage'
import { approvalReference } from '../services/approvalMath'
import { useStore } from '../state/RecruiteOneStore'
import type { Vacancy } from '../types'
import { ApprovalOverview } from './approval/ApprovalViews'
import { vacancyStatusLabel } from './StatusBadges'
import { VacancyCvsPanel } from './VacancyCvsPanel'
import { VacancyPipelineTab } from './VacancyPipelineTab'
import { ShareLink } from './ShareLink'

type Tab = 'overview' | 'jd' | 'weights' | 'pipeline' | 'cvs' | 'approval'

interface VacancyDetailModalProps {
  vacancy: Vacancy
  onClose: () => void
  onUpload: (vacancy: Vacancy) => void
  initialBatchId?: string | null
}

export function VacancyDetailModal({ vacancy, onClose, onUpload, initialBatchId = null }: VacancyDetailModalProps) {
  const { jds, approvals, updateVacancy } = useStore()
  const [tab, setTab] = useState<Tab>(initialBatchId ? 'cvs' : 'overview')
  const [confirmClose, setConfirmClose] = useState(false)
  const jd = jds.find((item) => item.id === vacancy.jd_id)
  const approval = approvals.find((item) => item.id === vacancy.approval_id)
  const stage = vacancyStage(vacancy)

  return (
    <Modal
      open
      onClose={onClose}
      title={vacancy.title}
      description={jd ? `${jd.name} · ${jd.role}` : 'Job description unavailable'}
      closeOnBackdrop={false}
      footer={
        <>
          {vacancy.status === 'closed' ? (
            <Button variant="secondary" icon={<RotateCcw />} onClick={() => updateVacancy(vacancy.id, { status: 'open' })}>
              Reopen vacancy
            </Button>
          ) : (
            <Button variant="secondary" icon={<CircleCheck />} onClick={() => setConfirmClose(true)}>
              Close vacancy
            </Button>
          )}
          <span className="modal__footer-spacer" />
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button icon={<Upload />} disabled={vacancy.collection_closed_at !== null || vacancy.status === 'closed'} onClick={() => onUpload(vacancy)}>
            Upload CVs
          </Button>
        </>
      }
    >
      <Tabs
        label="Vacancy sections"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'jd', label: 'Job description' },
          { value: 'weights', label: 'Weights' },
          { value: 'pipeline', label: 'Pipeline' },
          { value: 'cvs', label: `CVs (${vacancy.candidate_count})` },
          { value: 'approval', label: 'Approval' },
        ]}
      >
        {tab === 'overview' && (
          <div className="form-stack">
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-card__value">{vacancyStatusLabel(vacancy.status)}</div>
                <div className="stat-card__label">Status</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__value">{vacancy.candidate_count}</div>
                <div className="stat-card__label">CVs received</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__value">{vacancy.evaluated_count}</div>
                <div className="stat-card__label">Evaluated</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__value">{vacancy.shortlisted_count}</div>
                <div className="stat-card__label">Shortlisted</div>
              </div>
            </div>
            <dl className="detail-list detail-list--grid">
              <div>
                <dt>Stage</dt>
                <dd>
                  <Badge tone={stage.tone}>{stage.label}</Badge>
                </dd>
              </div>
              <div>
                <dt>Closing date</dt>
                <dd>{formatDate(vacancy.closing_date)}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatDate(vacancy.created_at)}</dd>
              </div>
              <div>
                <dt>Department</dt>
                <dd>{vacancy.department}</dd>
              </div>
              <div>
                <dt>Pipeline</dt>
                <dd>{vacancy.pipeline ? vacancy.pipeline.name : 'Not scheduled'}</dd>
              </div>
              <div>
                <dt>Hiring approval</dt>
                <dd>{approval ? `${approval.position_name} · ${approvalReference(approval)}` : 'None'}</dd>
              </div>
              <div>
                <dt>CV collection</dt>
                <dd>
                  {vacancy.collection_closed_at
                    ? `Closed ${formatDate(vacancy.collection_closed_at)}`
                    : collectionState(vacancy) === 'ended'
                      ? `Ended ${formatDate(vacancy.closing_date)}, not closed by HR yet`
                      : 'Open'}
                </dd>
              </div>
            </dl>
            <div>
              <p className="mini-heading">Application link</p>
              {vacancy.share_token ? <ShareLink token={vacancy.share_token} /> : <p className="wizard__muted">This vacancy is not shared publicly.</p>}
            </div>
          </div>
        )}

        {tab === 'jd' &&
          (jd ? (
            <div className="form-stack">
              <dl className="detail-list detail-list--grid">
                <div>
                  <dt>Role</dt>
                  <dd>{jd.role}</dd>
                </div>
                <div>
                  <dt>Sector</dt>
                  <dd>{jd.sector}</dd>
                </div>
                <div>
                  <dt>Level</dt>
                  <dd>{titleCase(jd.level)}</dd>
                </div>
              </dl>
              <div className="bucket-grid">
                {bucketDefinitions.map(({ key, label }) => (
                  <section key={key} className="bucket">
                    <h3 className="bucket__title">{label}</h3>
                    {jd.buckets[key].length === 0 ? (
                      <p className="bucket__empty">None listed.</p>
                    ) : (
                      <ul className="plain-list">
                        {jd.buckets[key].map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            </div>
          ) : (
            <p className="wizard__muted">The job description for this vacancy is no longer available.</p>
          ))}

        {tab === 'weights' &&
          (jd ? (
            <div className="weight-summary">
              {bucketDefinitions.map(({ key, label }) => (
                <MeterBar key={key} label={label} value={jd.weights[key]} display={`${jd.weights[key]}%`} />
              ))}
            </div>
          ) : (
            <p className="wizard__muted">No weights available.</p>
          ))}

        {tab === 'pipeline' && <VacancyPipelineTab vacancy={vacancy} />}

        {tab === 'cvs' && <VacancyCvsPanel vacancy={vacancy} jd={jd} initialBatchId={initialBatchId} onUpload={onUpload} />}

        {tab === 'approval' &&
          (approval ? (
            <ApprovalOverview approval={approval} />
          ) : (
            <p className="wizard__muted">This vacancy was created before hiring approvals existed, so it has no approval linked.</p>
          ))}
      </Tabs>

      <ConfirmModal
        open={confirmClose}
        title={`Close "${vacancy.title}"?`}
        message="Close the vacancy once the position is filled. The linked hiring approval will be marked Finished and no more CVs can be added."
        confirmLabel="Close vacancy"
        cancelLabel="Keep it open"
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => {
          updateVacancy(vacancy.id, { status: 'closed' })
          setConfirmClose(false)
        }}
      />
    </Modal>
  )
}
