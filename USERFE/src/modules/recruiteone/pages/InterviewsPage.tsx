import { CalendarCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchField } from '@/components/ui/SearchField'
import { formatDate, formatDateRange, relativeDay, titleCase } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { collectionState } from '../data/stage'
import { pooledCandidates } from '../services/interviewMath'
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
  const { interviews, vacancies, jds, candidates } = useStore()
  const { user, isHr } = useCurrentUser()
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase()
    return vacancies
      .filter((vacancy) => vacancy.pipeline !== null && vacancy.pipeline !== undefined)
      .filter((vacancy) => canOpenInterview(vacancy, user.id, isHr))
      .filter((vacancy) => term === '' || vacancy.title.toLowerCase().includes(term) || vacancy.department.toLowerCase().includes(term))
      .map((vacancy) => ({ vacancy, interview: interviews.find((item) => item.vacancy_id === vacancy.id) }))
  }, [vacancies, interviews, user.id, isHr, query])

  function open(interviewId: string | undefined) {
    if (interviewId) navigate(`/hr/recruiteone/interviews/${interviewId}`)
  }

  return (
    <>
      <PageHeader
        title="Interviews"
        description={
          isHr
            ? 'Every vacancy with a scheduled pipeline, from the moment it is scheduled. HR sees all interviews and all scores.'
            : 'Vacancies where you are an interviewer, from the moment the pipeline is scheduled. Read the job description and CVs and prepare your scorecard ahead of time. You only see your own scorecards and scores.'
        }
      />

      <Card flush className="reveal card--fill">
        <div className="toolbar">
          <span className="cell-secondary">
            Viewing as <strong>{user.name}</strong> ({isHr ? 'HR' : user.role})
          </span>
          <SearchField label="Search interviews" placeholder="Search vacancy or department" value={query} onChange={setQuery} />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck />}
            title="No interviews to show"
            description={isHr ? 'A vacancy appears here as soon as a pipeline is scheduled for it.' : 'You have not been assigned as an interviewer on any scheduled pipeline yet.'}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Vacancy</th>
                  <th scope="col">Role</th>
                  <th scope="col">Closing date</th>
                  <th scope="col">Interview dates</th>
                  <th scope="col">Candidates</th>
                  <th scope="col">Next stage</th>
                  <th scope="col">Your part</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ vacancy, interview }) => {
                  const stages = vacancy.pipeline?.stages ?? []
                  const jd = jds.find((item) => item.id === vacancy.jd_id)
                  const collectionClosed = vacancy.collection_closed_at !== null
                  const scoredCount = pooledCandidates(vacancy.id, candidates).filter((candidate) => candidate.score !== null).length
                  const progress = Object.values(interview?.progress ?? {})
                  const active = progress.filter((item) => item.outcome === 'active')
                  const selected = progress.filter((item) => item.outcome === 'selected').length
                  const furthest = active.reduce((best, item) => Math.max(best, item.stage_index), 0)
                  const next = stages.map((stage) => stage.scheduled_date).filter((date): date is string => date !== null && date >= todayIso()).sort()[0]
                  const mine = stages.filter((stage) => stage.interviewer_ids.includes(user.id))
                  return (
                    <tr key={vacancy.id} className={interview ? 'row-clickable' : undefined} onClick={() => open(interview?.id)}>
                      <td className="cell-wide">
                        <button type="button" className="link-button" disabled={!interview} onClick={() => open(interview?.id)}>
                          {vacancy.title}
                        </button>
                        <p className="cell-secondary">{vacancy.department}</p>
                      </td>
                      <td>
                        {jd?.role ?? '—'}
                        {jd && <p className="cell-secondary">{titleCase(jd.level)} level</p>}
                      </td>
                      <td className="nowrap">
                        {formatDate(vacancy.closing_date)}
                        <p className="cell-secondary">
                          {collectionClosed
                            ? `Collection closed ${formatDate(vacancy.collection_closed_at)}`
                            : vacancy.closing_date
                              ? relativeDay(vacancy.closing_date)
                              : 'No closing date set'}
                        </p>
                      </td>
                      <td className="nowrap">
                        {formatDateRange(stages.map((stage) => stage.scheduled_date))}
                        <p className="cell-secondary">
                          {stages.length} {stages.length === 1 ? 'stage' : 'stages'}
                        </p>
                      </td>
                      <td className="nowrap">
                        {collectionClosed ? (
                          <>
                            {interview?.candidate_ids.length ?? 0} in interview
                            <p className="cell-secondary">
                              {active.length > 0 ? `${stages[furthest]?.name ?? 'Stage'} (${furthest + 1} of ${stages.length})` : `${selected} selected, ${progress.length - selected} out`}
                            </p>
                          </>
                        ) : (
                          <>
                            {collectionState(vacancy) === 'ended' ? <Badge tone="warning">Closing date passed</Badge> : <Badge tone="info">CV collection open</Badge>}
                            <p className="cell-secondary">
                              {scoredCount} {scoredCount === 1 ? 'CV' : 'CVs'} scored
                            </p>
                          </>
                        )}
                      </td>
                      <td className="cell-secondary nowrap">{formatDate(next ?? null)}</td>
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
