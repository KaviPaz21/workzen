import { ArrowLeft, Download, Eye, Layers, RefreshCw, Upload } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { formatDate } from '@/lib/format'
import { useStore } from '../state/RecruiteOneStore'
import type { Batch, Candidate, JobDescription, Vacancy } from '../types'
import type { ExportRow } from '../services/exportExcel'
import { CvDetailView } from './CvDetailView'
import { CvViewerModal } from './CvViewerModal'
import { ExportExcelModal } from './ExportExcelModal'
import { RecommendationBadge } from './StatusBadges'

interface VacancyCvsPanelProps {
  vacancy: Vacancy
  jd: JobDescription | undefined
  initialBatchId?: string | null
  onUpload: (vacancy: Vacancy) => void
}

function sortCandidates(candidates: Candidate[]) {
  return [...candidates].sort((a, b) => {
    const scoreA = a.score?.overall_score ?? -1
    const scoreB = b.score?.overall_score ?? -1
    return scoreB - scoreA || a.full_name.localeCompare(b.full_name)
  })
}

function scoringBadge(candidate: Candidate) {
  if (candidate.score_status === 'failed') return <Badge tone="danger">Failed</Badge>
  if (candidate.score_status === 'scoring') return <Badge tone="warning">Scoring…</Badge>
  return <Badge tone="neutral">Waiting</Badge>
}

export function VacancyCvsPanel({ vacancy, jd, initialBatchId = null, onUpload }: VacancyCvsPanelProps) {
  const { batches, candidates, scoreCandidates } = useStore()
  const [batchId, setBatchId] = useState<string | null>(initialBatchId)
  const [candidateId, setCandidateId] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Candidate | null>(null)
  const [exportScope, setExportScope] = useState<'batch' | 'all' | null>(null)

  const vacancyBatches = batches.filter((batch) => batch.vacancy_id === vacancy.id)
  const batchCandidates = (batch: Batch) => candidates.filter((candidate) => candidate.batch_id === batch.id)
  const waiting = candidates.filter((candidate) => candidate.vacancy_ids.includes(vacancy.id) && candidate.batch_id === null && candidate.source === 'application')
  const batch = vacancyBatches.find((item) => item.id === batchId) ?? null
  const selected = candidates.find((candidate) => candidate.id === candidateId) ?? null

  function exportRows(list: Candidate[]): ExportRow[] {
    return list
      .filter((candidate) => candidate.score !== null)
      .map((candidate) => ({
        candidate,
        score: candidate.score!,
        batchName: batches.find((item) => item.id === candidate.batch_id)?.name ?? '',
      }))
  }

  const overlays = (
    <>
      {viewing && <CvViewerModal candidate={viewing} onClose={() => setViewing(null)} />}
      {exportScope && (
        <ExportExcelModal
          vacancy={vacancy}
          jd={jd}
          rows={exportRows(exportScope === 'batch' && batch ? batchCandidates(batch) : vacancyBatches.flatMap(batchCandidates))}
          scopeLabel={exportScope === 'batch' && batch ? `Batch: ${batch.name}` : 'All batches'}
          onClose={() => setExportScope(null)}
        />
      )}
    </>
  )

  if (batch && selected && selected.batch_id === batch.id) {
    return (
      <>
        <CvDetailView
          candidate={selected}
          batch={batch}
          onBack={() => setCandidateId(null)}
          onViewCv={setViewing}
          onRetry={(candidate) => scoreCandidates([candidate.id])}
        />
        {overlays}
      </>
    )
  }

  if (batch) {
    const rows = sortCandidates(batchCandidates(batch))
    const scored = rows.filter((candidate) => candidate.score !== null)
    const unscored = rows.filter((candidate) => candidate.score === null && candidate.score_status !== 'scoring')
    return (
      <div className="cvs-panel">
        <button type="button" className="back-link back-link--button" onClick={() => setBatchId(null)}>
          <ArrowLeft aria-hidden="true" />
          All batches
        </button>
        <div className="cvs-panel__head">
          <div>
            <h3 className="cvs-panel__title">{batch.name}</h3>
            <p className="cell-secondary">
              Created {formatDate(batch.created_at)} · {rows.length} {rows.length === 1 ? 'CV' : 'CVs'} · {scored.length} scored. Highest score first.
            </p>
          </div>
          <div className="cvs-panel__actions">
            {unscored.length > 0 && (
              <Button variant="secondary" icon={<RefreshCw />} onClick={() => scoreCandidates(unscored.map((candidate) => candidate.id))}>
                Score {unscored.length} waiting
              </Button>
            )}
            <Button icon={<Download />} disabled={scored.length === 0} onClick={() => setExportScope('batch')}>
              Export Excel
            </Button>
          </div>
        </div>

        <div className="table-wrap table-wrap--plain">
          <table className="data-table data-table--compact">
            <thead>
              <tr>
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
                <tr key={candidate.id} className="row-clickable" onClick={() => setCandidateId(candidate.id)}>
                  <td className="cell-secondary">{candidate.score ? index + 1 : '—'}</td>
                  <td>
                    <div className="cell-person">
                      <Avatar name={candidate.full_name} small />
                      <div>
                        <button type="button" className="link-button" onClick={() => setCandidateId(candidate.id)}>
                          {candidate.full_name}
                        </button>
                        <p className="cell-secondary">{candidate.email || candidate.file_name}</p>
                      </div>
                    </div>
                  </td>
                  <td>{candidate.score ? <ScoreRing value={candidate.score.overall_score} size={34} /> : scoringBadge(candidate)}</td>
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
        {overlays}
      </div>
    )
  }

  const scoredTotal = vacancyBatches.flatMap(batchCandidates).filter((candidate) => candidate.score !== null).length

  return (
    <div className="cvs-panel">
      <div className="cvs-panel__head">
        <div>
          <h3 className="cvs-panel__title">CV batches</h3>
          <p className="cell-secondary">
            {vacancyBatches.length} {vacancyBatches.length === 1 ? 'batch' : 'batches'} · {vacancy.candidate_count} CVs received · {scoredTotal} scored in batches
          </p>
        </div>
        <div className="cvs-panel__actions">
          <Button variant="secondary" icon={<Download />} disabled={scoredTotal === 0} onClick={() => setExportScope('all')}>
            Export top candidates
          </Button>
          <Button icon={<Upload />} onClick={() => onUpload(vacancy)}>
            Upload CVs
          </Button>
        </div>
      </div>

      {waiting.length > 0 && (
        <div className="inbox-note">
          <span>
            <strong>{waiting.length}</strong> {waiting.length === 1 ? 'application is' : 'applications are'} waiting from the shared link.
          </span>
          <Button size="sm" variant="secondary" onClick={() => onUpload(vacancy)}>
            Fetch into a batch
          </Button>
        </div>
      )}

      {vacancyBatches.length === 0 ? (
        <EmptyState
          icon={<Layers />}
          title="No batches yet"
          description="Upload CVs or fetch the applications received through the shared link. Each group becomes a batch that is scored against the JD."
        />
      ) : (
        <div className="table-wrap table-wrap--plain">
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                <th scope="col">Batch</th>
                <th scope="col">Created</th>
                <th scope="col">CVs</th>
                <th scope="col">Scored</th>
                <th scope="col">Top score</th>
              </tr>
            </thead>
            <tbody>
              {vacancyBatches.map((item) => {
                const list = batchCandidates(item)
                const scoredList = list.filter((candidate) => candidate.score !== null)
                const top = scoredList.reduce((best, candidate) => Math.max(best, candidate.score?.overall_score ?? 0), 0)
                return (
                  <tr key={item.id} className="row-clickable" onClick={() => setBatchId(item.id)}>
                    <td>
                      <button type="button" className="link-button" onClick={() => setBatchId(item.id)}>
                        {item.name}
                      </button>
                    </td>
                    <td className="cell-secondary">{formatDate(item.created_at)}</td>
                    <td>{list.length}</td>
                    <td>
                      {scoredList.length} / {list.length}
                    </td>
                    <td>{scoredList.length > 0 ? top : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {overlays}
    </div>
  )
}
