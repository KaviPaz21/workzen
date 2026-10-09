import { CalendarCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchField } from '@/components/ui/SearchField'
import { formatDate, titleCase } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { useCurrentUser } from '../state/CurrentUser'
import { todayIso, useStore } from '../state/RecruiteOneStore'
import type { Vacancy } from '../types'

export function canOpenInterview(vacancy: Vacancy | undefined, userId: string, isHr: boolean) {
  if (isHr) return true
  return (vacancy?.pipeline?.stages ?? []).some((stage) => stage.interviewer_ids.includes(userId))
}

export function InterviewsPage() {
  usePageTitle('Interviews')
  const navigate = useNavigate()
  const { interviews, vacancies, jds } = useStore()
  const { user, isHr } = useCurrentUser()
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase()
    return interviews
      .map((interview) => ({ interview, vacancy: vacancies.find((item) => item.id === interview.vacancy_id) }))
      .filter(({ vacancy }) => canOpenInterview(vacancy, user.id, isHr))
      .filter(({ vacancy }) => term === '' || (vacancy?.title.toLowerCase().includes(term) ?? false))
  }, [interviews, vacancies, user.id, isHr, query])

  return (
    <>
      <PageHeader
        title="Interviews"
        description={
          isHr
            ? 'Every vacancy whose CV collection is closed. HR sees all interviews and all scores.'
            : 'Interviews where you are assigned as an interviewer. You only see your own scorecards and scores.'
        }
      />

      <Card flush className="reveal card--fill">
        <div className="toolbar">
          <span className="cell-secondary">
            Viewing as <strong>{user.name}</strong> ({isHr ? 'HR' : user.role})
          </span>
          <SearchField label="Search interviews" placeholder="Search vacancy" value={query} onChange={setQuery} />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck />}
            title="No interviews to show"
            description={isHr ? 'An interview is created when you close the CV collection of a vacancy in the CV pool.' : 'You have not been assigned to any interview yet.'}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Vacancy</th>
                  <th scope="col">Role</th>
                  <th scope="col">Candidates</th>
                  <th scope="col">Progress</th>
                  <th scope="col">Next stage date</th>
                  <th scope="col">Collection closed</th>
                  <th scope="col">Your part</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ interview, vacancy }) => {
                  const stages = vacancy?.pipeline?.stages ?? []
                  const jd = jds.find((item) => item.id === vacancy?.jd_id)
                  const progress = Object.values(interview.progress)
                  const active = progress.filter((item) => item.outcome === 'active')
                  const selected = progress.filter((item) => item.outcome === 'selected').length
                  const furthest = active.reduce((best, item) => Math.max(best, item.stage_index), 0)
                  const next = stages.map((stage) => stage.scheduled_date).filter((date): date is string => date !== null && date >= todayIso()).sort()[0]
                  const mine = stages.filter((stage) => stage.interviewer_ids.includes(user.id))
                  return (
                    <tr key={interview.id} className="row-clickable" onClick={() => navigate(`/hr/recruiteone/interviews/${interview.id}`)}>
                      <td className="cell-wide">
                        <button type="button" className="link-button" onClick={() => navigate(`/hr/recruiteone/interviews/${interview.id}`)}>
                          {vacancy?.title ?? 'Unknown vacancy'}
                        </button>
                        <p className="cell-secondary">{vacancy?.department}</p>
                      </td>
                      <td>
                        {jd?.role ?? '—'}
                        {jd && <p className="cell-secondary">{titleCase(jd.level)} level</p>}
                      </td>
                      <td>{interview.candidate_ids.length}</td>
                      <td className="nowrap">
                        {active.length > 0 ? `${stages[furthest]?.name ?? 'Stage'} (${furthest + 1} of ${stages.length})` : `${selected} selected, ${progress.length - selected} out`}
                      </td>
                      <td className="cell-secondary">{formatDate(next ?? null)}</td>
                      <td className="cell-secondary">{formatDate(interview.created_at)}</td>
                      <td>
                        {isHr && <Badge tone="success">HR</Badge>}{' '}
                        {mine.length > 0 && <Badge tone="info">Interviewer: {mine.map((stage) => stage.name).join(', ')}</Badge>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          Showing {rows.length} {rows.length === 1 ? 'interview' : 'interviews'}
        </div>
      </Card>
    </>
  )
}
