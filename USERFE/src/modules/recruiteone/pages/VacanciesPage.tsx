import { BriefcaseBusiness, Plus, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { FilterTabs, type FilterOption } from '@/components/ui/FilterTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchField } from '@/components/ui/SearchField'
import { formatDate } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { NewVacancyModal } from '../components/NewVacancyModal'
import { VacancyStatusBadge } from '../components/StatusBadges'
import { UploadCvsModal } from '../components/UploadCvsModal'
import { VacancyDetailModal } from '../components/VacancyDetailModal'
import { vacancyStage } from '../data/stage'
import { useStore } from '../state/RecruiteOneStore'
import type { VacancyStatus } from '../types'

type StatusFilter = 'all' | VacancyStatus

export function VacanciesPage() {
  usePageTitle('Vacancies')
  const [searchParams, setSearchParams] = useSearchParams()
  const { jds, vacancies } = useStore()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [creating, setCreating] = useState(false)
  const [uploadVacancyId, setUploadVacancyId] = useState<string | null>(null)
  const openId = searchParams.get('open')
  const openBatchId = searchParams.get('batch')

  const count = (value: VacancyStatus) => vacancies.filter((vacancy) => vacancy.status === value).length
  const options: FilterOption<StatusFilter>[] = [
    { value: 'all', label: 'All', count: vacancies.length },
    { value: 'open', label: 'Open', count: count('open') },
    { value: 'on_hold', label: 'On hold', count: count('on_hold') },
    { value: 'draft', label: 'Draft', count: count('draft') },
    { value: 'closed', label: 'Closed', count: count('closed') },
  ]

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase()
    return vacancies.filter((vacancy) => {
      const matchesStatus = status === 'all' || vacancy.status === status
      const matchesQuery = term === '' || vacancy.title.toLowerCase().includes(term) || vacancy.department.toLowerCase().includes(term)
      return matchesStatus && matchesQuery
    })
  }, [vacancies, query, status])

  const jdName = (jdId: string) => jds.find((jd) => jd.id === jdId)?.name ?? 'Unknown JD'
  const detail = vacancies.find((vacancy) => vacancy.id === openId) ?? null

  function openDetail(id: string) {
    setSearchParams({ open: id }, { replace: true })
  }

  function closeDetail() {
    setSearchParams({}, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Vacancies"
        description="Track every role you are hiring for and how far candidate evaluation has progressed."
        actions={
          <Button icon={<Plus />} onClick={() => setCreating(true)}>
            New vacancy
          </Button>
        }
      />

      <Card flush className="reveal card--fill">
        <div className="toolbar">
          <FilterTabs label="Filter by status" options={options} value={status} onChange={setStatus} />
          <SearchField label="Search vacancies" placeholder="Search title or department" value={query} onChange={setQuery} />
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={<BriefcaseBusiness />} title="No vacancies found" description="Try a different search or clear the status filter." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Vacancy</th>
                  <th scope="col">CVs</th>
                  <th scope="col">Evaluated</th>
                  <th scope="col">Closing date</th>
                  <th scope="col">Stage</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Upload CVs</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((vacancy) => {
                  const stage = vacancyStage(vacancy)
                  const percent = vacancy.candidate_count === 0 ? 0 : Math.round((vacancy.evaluated_count / vacancy.candidate_count) * 100)
                  return (
                    <tr key={vacancy.id} className="row-clickable" onClick={() => openDetail(vacancy.id)}>
                      <td className="cell-wide">
                        <button type="button" className="link-button" onClick={() => openDetail(vacancy.id)}>
                          {vacancy.title}
                        </button>
                        <p className="cell-secondary">
                          {vacancy.department} · JD: {jdName(vacancy.jd_id)}
                        </p>
                      </td>
                      <td>{vacancy.candidate_count}</td>
                      <td>
                        <div className="mini-progress">
                          <span>
                            {vacancy.evaluated_count} / {vacancy.candidate_count}
                          </span>
                          <div className="mini-progress__track" aria-hidden="true">
                            <div className="mini-progress__fill" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="cell-secondary">{formatDate(vacancy.closing_date)}</td>
                      <td>
                        <Badge tone={stage.tone}>{stage.label}</Badge>
                      </td>
                      <td>
                        <VacancyStatusBadge status={vacancy.status} />
                      </td>
                      <td className="align-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Upload />}
                          disabled={vacancy.collection_closed_at !== null}
                          aria-label={`Upload CVs for ${vacancy.title}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            setUploadVacancyId(vacancy.id)
                          }}
                        >
                          Upload CVs
                        </Button>
                      </td>
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

      {creating && (
        <NewVacancyModal
          onClose={() => setCreating(false)}
          onUploadNow={(vacancy) => {
            setCreating(false)
            setUploadVacancyId(vacancy.id)
          }}
        />
      )}

      {detail && (
        <VacancyDetailModal
          key={`${detail.id}-${openBatchId ?? ''}`}
          vacancy={detail}
          initialBatchId={openBatchId}
          onClose={closeDetail}
          onUpload={(vacancy) => setUploadVacancyId(vacancy.id)}
        />
      )}

      {uploadVacancyId && (
        <UploadCvsModal
          initialVacancyId={uploadVacancyId}
          onClose={() => setUploadVacancyId(null)}
          onViewBatch={(vacancyId, batchId) => {
            setUploadVacancyId(null)
            setSearchParams({ open: vacancyId, batch: batchId }, { replace: true })
          }}
        />
      )}
    </>
  )
}
