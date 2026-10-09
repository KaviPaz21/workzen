import { ArrowLeft, CalendarCheck, Download, Eye, Layers, RefreshCw, Upload, UsersRound, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { EmptyState } from '@/components/ui/EmptyState'
import { FilterTabs, type FilterOption } from '@/components/ui/FilterTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { SearchField } from '@/components/ui/SearchField'
import { formatDate, titleCase } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { CloseCollectionModal } from '../components/CloseCollectionModal'
import { CvReasoningModal } from '../components/CvReasoningModal'
import { CvViewerModal } from '../components/CvViewerModal'
import { ExportExcelModal } from '../components/ExportExcelModal'
import { PipelineStageList } from '../components/VacancyPipelineTab'
import { RecommendationBadge } from '../components/StatusBadges'
import { UploadCvsModal } from '../components/UploadCvsModal'
import type { ExportRow } from '../services/exportExcel'
import { useStore } from '../state/RecruiteOneStore'
import type { Batch, Candidate, JobDescription, Vacancy } from '../types'

type CollectionFilter = 'all' | 'collecting' | 'closed'
type PoolTab = 'batches' | 'selected' | 'role'

function sortCandidates(list: Candidate[]) {
  return [...list].sort((a, b) => (b.score?.overall_score ?? -1) - (a.score?.overall_score ?? -1) || a.full_name.localeCompare(b.full_name))
}

function ScoreCell({ candidate }: { candidate: Candidate }) {
  if (candidate.score) return <ScoreRing value={candidate.score.overall_score} size={34} />
  if (candidate.score_status === 'failed') return <Badge tone="danger">Failed</Badge>
  if (candidate.score_status === 'scoring') return <Badge tone="warning">Scoring…</Badge>
  return <Badge tone="neutral">Waiting</Badge>
}

export function CvPoolPage() {
  usePageTitle('CV pool')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { vacancies, batches } = useStore()
  const [uploading, setUploading] = useState(false)
  const vacancyId = params.get('vacancy')
  const batchId = params.get('batch')
  const uploadParam = params.get('upload')

  const vacancy = vacancies.find((item) => item.id === vacancyId) ?? null
  const batch = batches.find((item) => item.id === batchId && item.vacancy_id === vacancy?.id) ?? null
  const uploadOpen = uploading || uploadParam !== null

  function go(next: { vacancy?: string; batch?: string }) {
    const nextParams: Record<string, string> = {}
    if (next.vacancy) nextParams.vacancy = next.vacancy
    if (next.batch) nextParams.batch = next.batch
    setParams(nextParams)
  }

  function closeUpload() {
    setUploading(false)
    if (uploadParam !== null) setParams(vacancyId ? { vacancy: vacancyId } : {}, { replace: true })
  }

  return (
    <>
      {!vacancy && <VacancyTable onOpen={(id) => go({ vacancy: id })} onUpload={() => setUploading(true)} />}
      {vacancy && !batch && <VacancyPool vacancy={vacancy} onBack={() => go({})} onOpenBatch={(id) => go({ vacancy: vacancy.id, batch: id })} onUpload={() => setUploading(true)} />}
      {vacancy && batch && <BatchPool vacancy={vacancy} batch={batch} onBack={() => go({ vacancy: vacancy.id })} />}

      {uploadOpen && (
        <UploadCvsModal
          initialVacancyId={uploadParam ?? vacancy?.id ?? null}
          onClose={closeUpload}
          onViewBatch={(vId, bId) => {
            setUploading(false)
            navigate(`/hr/recruiteone/cv-pool?vacancy=${vId}&batch=${bId}`)
          }}
        />
      )}
    </>
  )
}

function VacancyTable({ onOpen, onUpload }: { onOpen: (id: string) => void; onUpload: () => void }) {
  const { vacancies, batches, candidates, jds } = useStore()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<CollectionFilter>('all')

  const stats = (vacancy: Vacancy) => {
    const own = batches.filter((batch) => batch.vacancy_id === vacancy.id)
    const inBatches = candidates.filter((candidate) => own.some((batch) => batch.id === candidate.batch_id))
    return {
      batches: own.length,
      listed: inBatches.length,
      scored: inBatches.filter((candidate) => candidate.score !== null).length,
      selected: candidates.filter((candidate) => candidate.selected && candidate.vacancy_ids.includes(vacancy.id)).length,
    }
  }

  const options: FilterOption<CollectionFilter>[] = [
    { value: 'all', label: 'All', count: vacancies.length },
    { value: 'collecting', label: 'Collecting', count: vacancies.filter((vacancy) => !vacancy.collection_closed_at).length },
    { value: 'closed', label: 'Collection closed', count: vacancies.filter((vacancy) => vacancy.collection_closed_at).length },
  ]

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase()
    return vacancies.filter((vacancy) => {
      const closed = vacancy.collection_closed_at !== null
      const matchesFilter = filter === 'all' || (filter === 'closed' ? closed : !closed)
      return matchesFilter && (term === '' || vacancy.title.toLowerCase().includes(term) || vacancy.department.toLowerCase().includes(term))
    })
  }, [vacancies, query, filter])

  return (
    <>
      <PageHeader
        title="CV pool"
        description="Pick a vacancy to see its batches and CVs, select candidates for interview, or re-evaluate."
        actions={
          <Button icon={<Upload />} onClick={onUpload}>
            Upload CVs
          </Button>
        }
      />
      <Card flush className="reveal card--fill">
        <div className="toolbar">
          <FilterTabs label="Filter vacancies" options={options} value={filter} onChange={setFilter} />
          <SearchField label="Search vacancies" placeholder="Search vacancy or department" value={query} onChange={setQuery} />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<UsersRound />} title="No vacancies found" description="Try a different search or filter." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Vacancy</th>
                  <th scope="col">Role</th>
                  <th scope="col">Batches</th>
                  <th scope="col">CVs received</th>
                  <th scope="col">Scored</th>
                  <th scope="col">Selected</th>
                  <th scope="col">CV collection</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((vacancy) => {
                  const numbers = stats(vacancy)
                  const jd = jds.find((item) => item.id === vacancy.jd_id)
                  return (
                    <tr key={vacancy.id} className="row-clickable" onClick={() => onOpen(vacancy.id)}>
                      <td className="cell-wide">
                        <button type="button" className="link-button" onClick={() => onOpen(vacancy.id)}>
                          {vacancy.title}
                        </button>
                        <p className="cell-secondary">{vacancy.department}</p>
                      </td>
                      <td>
                        {jd?.role ?? '—'}
                        {jd && <p className="cell-secondary">{titleCase(jd.level)} level</p>}
                      </td>
                      <td>{numbers.batches}</td>
                      <td>{vacancy.candidate_count}</td>
                      <td>
                        {numbers.scored} / {numbers.listed}
                      </td>
                      <td>{numbers.selected}</td>
                      <td>{vacancy.collection_closed_at ? <Badge tone="danger">Closed {formatDate(vacancy.collection_closed_at)}</Badge> : <Badge tone="success">Collecting</Badge>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          Showing {rows.length} of {vacancies.length} vacancies
        </div>
      </Card>
    </>
  )
}

interface VacancyPoolProps {
  vacancy: Vacancy
  onBack: () => void
  onOpenBatch: (id: string) => void
  onUpload: () => void
}

function VacancyPool({ vacancy, onBack, onOpenBatch, onUpload }: VacancyPoolProps) {
  const navigate = useNavigate()
  const { batches, candidates, jds, interviews, toggleSelected, reevaluate } = useStore()
  const [tab, setTab] = useState<PoolTab>('batches')
  const [confirmingReevaluate, setConfirmingReevaluate] = useState(false)
  const [closing, setClosing] = useState(false)
  const [viewing, setViewing] = useState<Candidate | null>(null)
  const [reasoningId, setReasoningId] = useState<string | null>(null)

  const jd = jds.find((item) => item.id === vacancy.jd_id)
  const own = batches.filter((batch) => batch.vacancy_id === vacancy.id)
  const pooled = candidates.filter((candidate) => own.some((batch) => batch.id === candidate.batch_id))
  const selected = sortCandidates(candidates.filter((candidate) => candidate.selected && candidate.vacancy_ids.includes(vacancy.id)))
  const closed = vacancy.collection_closed_at !== null
  const interview = interviews.find((item) => item.vacancy_id === vacancy.id)
  const eligible = pooled.filter((candidate) => !candidate.selected)

  const options: FilterOption<PoolTab>[] = [
    { value: 'batches', label: 'Batches', count: own.length },
    { value: 'selected', label: 'Selected candidates', count: selected.length },
    { value: 'role', label: 'Role and interview' },
  ]

  return (
    <>
      <button type="button" className="back-link back-link--button" onClick={onBack}>
        <ArrowLeft aria-hidden="true" />
        All vacancies
      </button>
      <PageHeader
        title={vacancy.title}
        description={`${jd ? `${jd.role} · ${jd.sector} · ${titleCase(jd.level)} level` : 'Job description unavailable'}${closed ? ` · CV collection closed ${formatDate(vacancy.collection_closed_at)}` : ''}`}
        actions={
          <>
            <Button variant="secondary" icon={<Upload />} disabled={closed} onClick={onUpload}>
              Upload CVs
            </Button>
            <Button variant="secondary" icon={<RefreshCw />} disabled={eligible.length === 0} onClick={() => setConfirmingReevaluate(true)}>
              Re-evaluate vacancy
            </Button>
            {closed && interview ? (
              <Button icon={<CalendarCheck />} onClick={() => navigate(`/hr/recruiteone/interviews/${interview.id}`)}>
                Open interview
              </Button>
            ) : (
              <Button icon={<CalendarCheck />} onClick={() => setClosing(true)}>
                Close collection
              </Button>
            )}
          </>
        }
      />

      <Card flush className="reveal card--fill">
        <div className="toolbar">
          <FilterTabs label="Vacancy sections" options={options} value={tab} onChange={setTab} />
        </div>

        {tab === 'batches' &&
          (own.length === 0 ? (
            <EmptyState icon={<Layers />} title="No batches yet" description="Upload CVs or fetch the applications from the shared link to create the first batch." />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Batch</th>
                    <th scope="col">Created</th>
                    <th scope="col">CVs</th>
                    <th scope="col">Scored</th>
                    <th scope="col">Selected</th>
                    <th scope="col">Top score</th>
                  </tr>
                </thead>
                <tbody>
                  {own.map((batch) => {
                    const list = candidates.filter((candidate) => candidate.batch_id === batch.id)
                    const scored = list.filter((candidate) => candidate.score !== null)
                    return (
                      <tr key={batch.id} className="row-clickable" onClick={() => onOpenBatch(batch.id)}>
                        <td>
                          <button type="button" className="link-button" onClick={() => onOpenBatch(batch.id)}>
                            {batch.name}
                          </button>
                        </td>
                        <td className="cell-secondary">{formatDate(batch.created_at)}</td>
                        <td>{list.length}</td>
                        <td>
                          {scored.length} / {list.length}
                        </td>
                        <td>{list.filter((candidate) => candidate.selected).length}</td>
                        <td>{scored.length > 0 ? Math.max(...scored.map((candidate) => candidate.score?.overall_score ?? 0)) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}

        {tab === 'selected' &&
          (selected.length === 0 ? (
            <EmptyState icon={<UsersRound />} title="No candidates selected" description="Open a batch and tick the CVs that should go to interview. They appear here." />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Candidate</th>
                    <th scope="col">Score</th>
                    <th scope="col">Recommendation</th>
                    <th scope="col">Batch</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selected.map((candidate) => (
                    <tr key={candidate.id} className="row-clickable" onClick={() => setReasoningId(candidate.id)}>
                      <td>
                        <div className="cell-person">
                          <Avatar name={candidate.full_name} small />
                          <div>
                            <button type="button" className="link-button" onClick={() => setReasoningId(candidate.id)}>
                              {candidate.full_name}
                            </button>
                            <p className="cell-secondary">{candidate.email || candidate.file_name}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <ScoreCell candidate={candidate} />
                      </td>
                      <td>{candidate.score ? <RecommendationBadge recommendation={candidate.score.recommendation} /> : '—'}</td>
                      <td className="cell-secondary">{batches.find((batch) => batch.id === candidate.batch_id)?.name ?? '—'}</td>
                      <td className="align-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Eye />}
                          aria-label={`View CV of ${candidate.full_name}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            setViewing(candidate)
                          }}
                        >
                          CV
                        </Button>{' '}
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<X />}
                          disabled={closed}
                          aria-label={`Remove ${candidate.full_name} from the selection`}
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleSelected(candidate.id)
                          }}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {tab === 'role' && (
          <div className="pool-scroll">
            <section className="pool-section">
              <h3 className="pool-section__title">Role</h3>
              <dl className="detail-list detail-list--grid">
                <div>
                  <dt>Job description</dt>
                  <dd>{jd?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>{jd?.role ?? '—'}</dd>
                </div>
                <div>
                  <dt>Sector</dt>
                  <dd>{jd?.sector ?? '—'}</dd>
                </div>
                <div>
                  <dt>Level</dt>
                  <dd>{jd ? titleCase(jd.level) : '—'}</dd>
                </div>
                <div>
                  <dt>Closing date</dt>
                  <dd>{formatDate(vacancy.closing_date)}</dd>
                </div>
                <div>
                  <dt>CV collection</dt>
                  <dd>{closed ? `Closed ${formatDate(vacancy.collection_closed_at)}` : 'Open'}</dd>
                </div>
              </dl>
            </section>
            <section className="pool-section">
              <h3 className="pool-section__title">Interview pipeline</h3>
              {vacancy.pipeline ? (
                <PipelineStageList pipeline={vacancy.pipeline} />
              ) : (
                <p className="wizard__muted">No pipeline has been scheduled. Add one from the vacancy before closing the collection.</p>
              )}
            </section>
          </div>
        )}

        <div className="table-footer">
          {tab === 'batches' && `${own.length} ${own.length === 1 ? 'batch' : 'batches'} · ${pooled.length} CVs listed`}
          {tab === 'selected' && `${selected.length} selected. Selected CVs are never re-evaluated.`}
          {tab === 'role' && 'Role and interview details for this vacancy.'}
        </div>
      </Card>

      <ConfirmModal
        open={confirmingReevaluate}
        title="Re-evaluate this vacancy?"
        message={`${eligible.length} ${eligible.length === 1 ? 'CV' : 'CVs'} across all batches will be scored again against the current job description. ${
          pooled.length - eligible.length
        } selected ${pooled.length - eligible.length === 1 ? 'CV is' : 'CVs are'} excluded and keep their scores.`}
        confirmLabel="Re-evaluate"
        cancelLabel="Cancel"
        onCancel={() => setConfirmingReevaluate(false)}
        onConfirm={() => {
          reevaluate(eligible.map((candidate) => candidate.id))
          setConfirmingReevaluate(false)
        }}
      />
      {closing && (
        <CloseCollectionModal
          vacancy={vacancy}
          selectedCount={selected.length}
          onClose={() => setClosing(false)}
          onOpenInterview={(created) => navigate(`/hr/recruiteone/interviews/${created.id}`)}
        />
      )}
      {viewing && <CvViewerModal candidate={viewing} onClose={() => setViewing(null)} />}
      {reasoningId && <CvReasoningModal candidateId={reasoningId} onClose={() => setReasoningId(null)} onViewCv={setViewing} />}
    </>
  )
}

function BatchPool({ vacancy, batch, onBack }: { vacancy: Vacancy; batch: Batch; onBack: () => void }) {
  const { candidates, jds, toggleSelected, reevaluate } = useStore()
  const [viewing, setViewing] = useState<Candidate | null>(null)
  const [reasoningId, setReasoningId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const jd: JobDescription | undefined = jds.find((item) => item.id === vacancy.jd_id)
  const closed = vacancy.collection_closed_at !== null

  const rows = sortCandidates(candidates.filter((candidate) => candidate.batch_id === batch.id))
  const scored = rows.filter((candidate) => candidate.score !== null)
  const eligible = rows.filter((candidate) => !candidate.selected)
  const exportRows: ExportRow[] = scored.map((candidate) => ({ candidate, score: candidate.score!, batchName: batch.name }))

  return (
    <>
      <button type="button" className="back-link back-link--button" onClick={onBack}>
        <ArrowLeft aria-hidden="true" />
        {vacancy.title}
      </button>
      <PageHeader
        title={batch.name}
        description={`Created ${formatDate(batch.created_at)} · ${rows.length} CVs · ${scored.length} scored · highest score first`}
        actions={
          <>
            <Button variant="secondary" icon={<Download />} disabled={scored.length === 0} onClick={() => setExporting(true)}>
              Export Excel
            </Button>
            <Button variant="secondary" icon={<RefreshCw />} disabled={eligible.length === 0} onClick={() => setConfirming(true)}>
              Re-evaluate batch
            </Button>
          </>
        }
      />

      <Card flush className="reveal card--fill">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Select for interview</span>
                </th>
                <th scope="col">Rank</th>
                <th scope="col">Candidate</th>
                <th scope="col">Score</th>
                <th scope="col">Recommendation</th>
                <th scope="col">Source</th>
                <th scope="col">
                  <span className="sr-only">View CV</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((candidate, index) => (
                <tr key={candidate.id} className="row-clickable" onClick={() => setReasoningId(candidate.id)}>
                  <td onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={candidate.selected}
                      disabled={closed}
                      aria-label={`Select ${candidate.full_name} for interview`}
                      onChange={() => toggleSelected(candidate.id)}
                    />
                  </td>
                  <td className="cell-secondary">{candidate.score ? index + 1 : '—'}</td>
                  <td>
                    <div className="cell-person">
                      <Avatar name={candidate.full_name} small />
                      <div>
                        <button type="button" className="link-button" onClick={() => setReasoningId(candidate.id)}>
                          {candidate.full_name}
                        </button>
                        <p className="cell-secondary">
                          {candidate.email || candidate.file_name}
                          {candidate.selected && ' · selected'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <ScoreCell candidate={candidate} />
                  </td>
                  <td>{candidate.score ? <RecommendationBadge recommendation={candidate.score.recommendation} /> : <span className="cell-secondary">—</span>}</td>
                  <td>{candidate.source === 'application' ? 'Application link' : 'Upload'}</td>
                  <td className="align-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Eye />}
                      aria-label={`View CV of ${candidate.full_name}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        setViewing(candidate)
                      }}
                    >
                      CV
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          {rows.filter((candidate) => candidate.selected).length} selected for interview. Selected CVs are never re-evaluated.
        </div>
      </Card>

      <ConfirmModal
        open={confirming}
        title="Re-evaluate this batch?"
        message={`${eligible.length} ${eligible.length === 1 ? 'CV' : 'CVs'} will be scored again against the current job description. ${
          rows.length - eligible.length
        } selected ${rows.length - eligible.length === 1 ? 'CV is' : 'CVs are'} excluded and keep their scores.`}
        confirmLabel="Re-evaluate"
        cancelLabel="Cancel"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          reevaluate(eligible.map((candidate) => candidate.id))
          setConfirming(false)
        }}
      />
      {exporting && <ExportExcelModal vacancy={vacancy} jd={jd} rows={exportRows} scopeLabel={`Batch: ${batch.name}`} onClose={() => setExporting(false)} />}
      {viewing && <CvViewerModal candidate={viewing} onClose={() => setViewing(null)} />}
      {reasoningId && <CvReasoningModal candidateId={reasoningId} onClose={() => setReasoningId(null)} onViewCv={setViewing} />}
    </>
  )
}
