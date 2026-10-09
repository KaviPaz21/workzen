import { BriefcaseBusiness, FileText, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ChipList } from '@/components/ui/ChipList'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { EmptyState } from '@/components/ui/EmptyState'
import { FilterTabs, type FilterOption } from '@/components/ui/FilterTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchField } from '@/components/ui/SearchField'
import { formatDate, titleCase } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { JdDetailModal } from '../components/JdDetailModal'
import { JdVacanciesModal } from '../components/JdVacanciesModal'
import { NewJdWizard } from '../components/NewJdWizard'
import { JdStatusBadge } from '../components/StatusBadges'
import { UploadCvsModal } from '../components/UploadCvsModal'
import { VacancyDetailModal } from '../components/VacancyDetailModal'
import { jdStateOf, useStore, vacancyCountsFor, type JdState } from '../state/RecruiteOneStore'
import type { JobDescription } from '../types'

type Filter = 'all' | 'published' | 'draft' | 'deleted'

export function JdsPage() {
  usePageTitle('Job descriptions')
  const [searchParams, setSearchParams] = useSearchParams()
  const { jds, vacancies, addJd } = useStore()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [promptJd, setPromptJd] = useState<JobDescription | null>(null)
  const [vacancyJdId, setVacancyJdId] = useState<string | null>(null)
  const [openVacancyId, setOpenVacancyId] = useState<string | null>(null)
  const [uploadVacancyId, setUploadVacancyId] = useState<string | null>(null)
  const [openBatchId, setOpenBatchId] = useState<string | null>(null)
  const wizardOpen = searchParams.get('new') === '1'

  function setWizardOpen(open: boolean) {
    setSearchParams(open ? { new: '1' } : {}, { replace: true })
  }

  function openVacancyPopup(jd: JobDescription) {
    setSelectedId(null)
    setPromptJd(null)
    setVacancyJdId(jd.id)
  }

  const states = useMemo(() => new Map(jds.map((jd) => [jd.id, jdStateOf(jd, vacancies)])), [jds, vacancies])
  const countState = (state: JdState) => jds.filter((jd) => states.get(jd.id) === state).length

  const options: FilterOption<Filter>[] = [
    { value: 'all', label: 'All', count: jds.length },
    { value: 'published', label: 'Published', count: countState('published') },
    { value: 'draft', label: 'Drafts', count: countState('draft') },
    { value: 'deleted', label: 'Deleted', count: countState('deleted') },
  ]

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase()
    return jds.filter((jd) => {
      const matchesFilter = filter === 'all' || states.get(jd.id) === filter
      const matchesQuery =
        term === '' ||
        jd.name.toLowerCase().includes(term) ||
        jd.role.toLowerCase().includes(term) ||
        jd.sector.toLowerCase().includes(term) ||
        jd.buckets.technical_skills.some((skill) => skill.toLowerCase().includes(term))
      return matchesFilter && matchesQuery
    })
  }, [jds, states, query, filter])

  const selected = jds.find((jd) => jd.id === selectedId) ?? null
  const vacancyJd = jds.find((jd) => jd.id === vacancyJdId) ?? null
  const openVacancy = vacancies.find((vacancy) => vacancy.id === openVacancyId) ?? null

  return (
    <>
      <PageHeader
        title="Job descriptions"
        description="The source of truth for every role. Vacancies and AI evaluations are built from these."
        actions={
          <Button icon={<Plus />} onClick={() => setWizardOpen(true)}>
            New JD
          </Button>
        }
      />

      <Card flush className="reveal card--fill">
        <div className="toolbar">
          <FilterTabs label="Filter job descriptions" options={options} value={filter} onChange={setFilter} />
          <SearchField label="Search job descriptions" placeholder="Search name, role or skill" value={query} onChange={setQuery} />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title="No job descriptions here"
            description={filter === 'deleted' ? 'Deleted JDs will appear in this list.' : 'Try a different search or switch the filter.'}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Job description</th>
                  <th scope="col">Level</th>
                  <th scope="col">Key skills</th>
                  <th scope="col">Vacancies</th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                  <th scope="col">
                    <span className="sr-only">Create vacancy</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((jd) => {
                  const counts = vacancyCountsFor(jd.id, vacancies)
                  const state = states.get(jd.id) ?? 'draft'
                  return (
                    <tr key={jd.id} className="row-clickable" onClick={() => setSelectedId(jd.id)}>
                      <td className="cell-wide">
                        <button type="button" className="link-button" onClick={() => setSelectedId(jd.id)}>
                          {jd.name}
                        </button>
                        <p className="cell-secondary">
                          {jd.role} · {jd.sector}
                        </p>
                      </td>
                      <td>{titleCase(jd.level)}</td>
                      <td>
                        <ChipList items={jd.buckets.technical_skills} limit={2} />
                      </td>
                      <td className="nowrap">{counts.total === 0 ? '—' : `${counts.active} active of ${counts.total}`}</td>
                      <td>
                        <JdStatusBadge state={state} />
                      </td>
                      <td className="cell-secondary">{formatDate(jd.updated_at)}</td>
                      <td className="align-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<BriefcaseBusiness />}
                          disabled={jd.deleted}
                          aria-label={`Vacancies for ${jd.name}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            openVacancyPopup(jd)
                          }}
                        >
                          Vacancy
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
          Showing {rows.length} of {jds.length} job descriptions
        </div>
      </Card>

      {wizardOpen && (
        <NewJdWizard
          open
          onClose={() => setWizardOpen(false)}
          onSave={addJd}
          onSaved={(created) => {
            setWizardOpen(false)
            setFilter('all')
            setPromptJd(created)
          }}
        />
      )}

      <JdDetailModal jd={selected} onClose={() => setSelectedId(null)} onProceed={openVacancyPopup} />

      <ConfirmModal
        open={promptJd !== null}
        title={`Create vacancy for "${promptJd?.name ?? ''}"?`}
        message="Your JD is saved. You can open a vacancy for it now, or do it later from the JD list."
        confirmLabel="Proceed"
        cancelLabel="Later"
        onCancel={() => setPromptJd(null)}
        onConfirm={() => promptJd && openVacancyPopup(promptJd)}
      />

      {vacancyJd && (
        <JdVacanciesModal
          jd={vacancyJd}
          onClose={() => setVacancyJdId(null)}
          onOpenVacancy={(vacancy) => setOpenVacancyId(vacancy.id)}
          onUploadNow={(vacancy) => setUploadVacancyId(vacancy.id)}
        />
      )}

      {openVacancy && (
        <VacancyDetailModal
          key={`${openVacancy.id}-${openBatchId ?? ''}`}
          vacancy={openVacancy}
          initialBatchId={openBatchId}
          onClose={() => {
            setOpenVacancyId(null)
            setOpenBatchId(null)
          }}
          onUpload={(vacancy) => setUploadVacancyId(vacancy.id)}
        />
      )}

      {uploadVacancyId && (
        <UploadCvsModal
          initialVacancyId={uploadVacancyId}
          onClose={() => setUploadVacancyId(null)}
          onViewBatch={(vacancyId, batchId) => {
            setUploadVacancyId(null)
            setOpenVacancyId(vacancyId)
            setOpenBatchId(batchId)
          }}
        />
      )}
    </>
  )
}
