import { Activity, ArrowUpRight, BriefcaseBusiness, CalendarCheck, ChartPie, FileText, ListChecks, ScanSearch, UploadCloud, UsersRound, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { StatCard } from '@/components/ui/StatCard'
import { formatDate } from '@/lib/format'
import { stagger } from '@/lib/stagger'
import { usePageTitle } from '@/lib/usePageTitle'
import { RecommendationBadge, vacancyStatusLabel } from '../components/StatusBadges'
import { jdStateOf, useStore } from '../state/RecruiteOneStore'
import { vacancyStage } from '../data/stage'
import type { Recommendation } from '../types'

const outcomeRows: { key: Recommendation; label: string; tone: string }[] = [
  { key: 'strong_match', label: 'Strong match', tone: 'green' },
  { key: 'potential_match', label: 'Potential match', tone: 'amber' },
  { key: 'not_a_match', label: 'Not a match', tone: 'coral' },
]

const quickActions = [
  { to: '/hr/recruiteone/jds?new=1', title: 'Create a JD', text: 'Paste a JD and let AI break it into requirements.', icon: FileText },
  { to: '/hr/recruiteone/vacancies', title: 'Open a vacancy', text: 'Link a JD to a vacancy and set openings and dates.', icon: BriefcaseBusiness },
  { to: '/hr/recruiteone/cv-pool', title: 'Upload CVs', text: 'Add PDF or DOCX resumes to your shared pool.', icon: UploadCloud },
  { to: '/hr/recruiteone/interviews', title: 'Open interviews', text: 'Score candidates stage by stage.', icon: CalendarCheck },
]

interface ActivityItem {
  id: string
  message: string
  detail: string
  created_at: string
  vacancyIds: string[]
}

export function DashboardPage() {
  usePageTitle('Dashboard')
  const { vacancies, jds, candidates, batches, interviews } = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const openVacancies = vacancies.filter((vacancy) => vacancy.status === 'open')
  const selected = openVacancies.find((vacancy) => vacancy.id === selectedId) ?? null
  const scopeLabel = selected ? selected.title : 'all vacancies'

  const scopeCandidates = selected ? candidates.filter((candidate) => candidate.vacancy_ids.includes(selected.id)) : candidates
  const activeJds = jds.filter((jd) => jdStateOf(jd, vacancies) === 'published').length
  const scored = scopeCandidates.filter((candidate) => candidate.score !== null)
  const averageScore = scored.length === 0 ? '—' : Math.round(scored.reduce((sum, candidate) => sum + (candidate.score?.overall_score ?? 0), 0) / scored.length)
  const breakdown: Record<Recommendation, number> = { strong_match: 0, potential_match: 0, not_a_match: 0 }
  scored.forEach((candidate) => {
    if (candidate.score) breakdown[candidate.score.recommendation] += 1
  })
  const totalOutcomes = outcomeRows.reduce((sum, row) => sum + breakdown[row.key], 0)
  const vacancyTitle = (id: string | undefined) => vacancies.find((vacancy) => vacancy.id === id)?.title ?? 'Unknown vacancy'
  const recentEvaluations = scored
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
    .slice(0, 5)
  const allActivity: ActivityItem[] = [
    ...jds.map((jd) => ({
      id: jd.id,
      message: `JD created: ${jd.name}`,
      detail: jd.role,
      created_at: jd.created_at,
      vacancyIds: vacancies.filter((vacancy) => vacancy.jd_id === jd.id).map((vacancy) => vacancy.id),
    })),
    ...vacancies.map((vacancy) => ({
      id: vacancy.id,
      message: `Vacancy opened: ${vacancy.title}`,
      detail: ` ${vacancy.openings === 1 ? 'opening' : 'openings'}`,
      created_at: vacancy.created_at,
      vacancyIds: [vacancy.id],
    })),
    ...batches.map((batch) => ({
      id: batch.id,
      message: `CV batch created: ${batch.name}`,
      detail: vacancyTitle(batch.vacancy_id),
      created_at: batch.created_at,
      vacancyIds: [batch.vacancy_id],
    })),
    ...interviews
      .filter((interview) => interview.candidate_ids.length > 0)
      .map((interview) => ({
        id: interview.id,
        message: `Interviews started for ${vacancyTitle(interview.vacancy_id)}`,
        detail: `${interview.candidate_ids.length} candidates`,
        created_at: vacancies.find((vacancy) => vacancy.id === interview.vacancy_id)?.collection_closed_at ?? interview.created_at,
        vacancyIds: [interview.vacancy_id],
      })),
  ]
  const recentActivity = allActivity
    .filter((item) => !selected || item.vacancyIds.includes(selected.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
    .slice(0, 6)

  function toggle(id: string) {
    setSelectedId((current) => (current === id ? null : id))
  }

  const selectedStage = selected ? vacancyStage(selected) : null

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={selected ? `Every number below is filtered to ${selected.title}. Select it again to go back to all vacancies.` : 'A live view of hiring across every open vacancy. Select a vacancy to filter the rest of the dashboard.'}
      />

      {selected && (
        <div className="dash-scope" role="status">
          <span className="dash-scope__text">
            Filtered to <strong>{selected.title}</strong>
            <span className="cell-secondary"> · {selected.department}</span>
          </span>
          <Button size="sm" variant="secondary" icon={<X />} onClick={() => setSelectedId(null)}>
            Clear filter
          </Button>
        </div>
      )}

      <div className="dash-top">
        <section className="hero-card reveal" aria-label="RecruiteOne overview">
          <span className="hero-card__badge">RecruiteOne · Live data</span>
          <h2 className="hero-card__title">
            Hire faster, with <em>evidence</em> behind every decision.
          </h2>
          <p className="hero-card__text">
            Write a JD, open a vacancy, build your CV pool, then let AI evaluate each candidate against the role.
          </p>
          <div className="hero-card__actions">
            <ButtonLink to="/hr/recruiteone/cv-pool" icon={<UsersRound />}>
              Open CV pool
            </ButtonLink>
            <ButtonLink to="/hr/recruiteone/jds?new=1" variant="secondary">
              Create a JD
            </ButtonLink>
          </div>
        </section>

        <div className="stat-grid">
          {selected && selectedStage ? (
            <StatCard index={0} label="Vacancy status" value={vacancyStatusLabel(selected.status)} hint={`${selectedStage.label} · closes ${formatDate(selected.closing_date)}`} />
          ) : (
            <StatCard index={0} label="Open vacancies" value={openVacancies.length} hint={`${activeJds} active JDs`} />
          )}
          <StatCard
            index={1}
            label={selected ? 'Candidates in vacancy' : 'Candidates in pool'}
            value={scopeCandidates.length}
            hint={selected ? 'CVs for this vacancy' : 'CVs across all vacancies'}
          />
          <StatCard index={2} label="Evaluations completed" value={scored.length} hint={selected ? `of ${scopeCandidates.length} CVs in this vacancy` : 'Scored by AI'} />
          <StatCard index={3} label="Average match score" value={averageScore} hint="Out of 100" />
        </div>
      </div>

      <section aria-labelledby="quick-actions">
        <h2 id="quick-actions" className="sr-only">
          Quick actions
        </h2>
        <div className="quick-actions">
          {quickActions.map(({ to, title, icon: Icon }, index) => (
            <Link key={title} to={to} className="quick-action reveal" style={stagger(index + 1)}>
              <span className="quick-action__icon" aria-hidden="true">
                <Icon />
              </span>
              {title}
              <ArrowUpRight aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <div className="split split--wide-left">
        <Card
          icon={<ListChecks />}
          title="Open vacancies in progress"
          description="Select a vacancy to filter the dashboard to it. Select it again to clear."
          flush
          className="reveal"
          action={
            <Link to="/hr/recruiteone/vacancies" className="text-link">
              All vacancies
            </Link>
          }
        >
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th scope="col">Vacancy</th>
                  <th scope="col">Stage</th>
                  <th scope="col">Evaluated</th>
                  <th scope="col">Shortlisted</th>
                  <th scope="col">Closes</th>
                  <th scope="col">
                    <span className="sr-only">Open vacancy</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {openVacancies.length === 0 && (
                  <tr>
                    <td colSpan={6} className="cell-secondary">No open vacancies yet.</td>
                  </tr>
                )}
                {openVacancies.map((vacancy) => {
                  const stage = vacancyStage(vacancy)
                  const percent = vacancy.candidate_count === 0 ? 0 : Math.round((vacancy.evaluated_count / vacancy.candidate_count) * 100)
                  const isSelected = vacancy.id === selected?.id
                  return (
                    <tr key={vacancy.id} className={`row-clickable${isSelected ? ' row-selected' : ''}`} onClick={() => toggle(vacancy.id)}>
                      <td>
                        <button
                          type="button"
                          className="link-button"
                          aria-pressed={isSelected}
                          onClick={(event) => {
                            event.stopPropagation()
                            toggle(vacancy.id)
                          }}
                        >
                          {vacancy.title}
                        </button>
                        <p className="cell-secondary">
                          {vacancy.department} · {vacancy.openings} {vacancy.openings === 1 ? 'opening' : 'openings'}
                        </p>
                      </td>
                      <td>
                        <Badge tone={stage.tone}>{stage.label}</Badge>
                      </td>
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
                      <td>{vacancy.shortlisted_count}</td>
                      <td className="cell-secondary">{formatDate(vacancy.closing_date)}</td>
                      <td className="align-right">
                        <Link
                          to={`/hr/recruiteone/vacancies?open=${vacancy.id}`}
                          className="icon-button icon-button--small"
                          aria-label={`Open ${vacancy.title} in Vacancies`}
                          title="Open in Vacancies"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <ArrowUpRight />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card icon={<ChartPie />} title="Evaluation outcomes" description={selected ? `Evaluations for ${scopeLabel}` : 'All completed evaluations'} className="reveal">
          <div
            className="stacked-bar"
            role="img"
            aria-label={outcomeRows.map((row) => `${row.label}: ${breakdown[row.key]}`).join(', ')}
          >
            {outcomeRows.map((row) => (
              <span
                key={row.key}
                className={`stacked-bar__segment stacked-bar__segment--${row.tone}`}
                style={{ width: `${totalOutcomes === 0 ? 0 : (breakdown[row.key] / totalOutcomes) * 100}%` }}
              />
            ))}
          </div>
          <ul className="outcome-list">
            {outcomeRows.map((row) => (
              <li key={row.key}>
                <span className={`outcome-list__swatch outcome-list__swatch--${row.tone}`} aria-hidden="true" />
                <span className="outcome-list__label">{row.label}</span>
                <span className="outcome-list__value">{breakdown[row.key]}</span>
                <span className="outcome-list__percent">{totalOutcomes === 0 ? 0 : Math.round((breakdown[row.key] / totalOutcomes) * 100)}%</span>
              </li>
            ))}
          </ul>
          {totalOutcomes === 0 && <p className="wizard__muted">Outcomes appear here once CVs have been scored.</p>}
        </Card>
      </div>

      <div className="split split--wide-left">
        <Card
          icon={<ScanSearch />}
          title="Recent evaluations"
          description={selected ? `The latest CVs scored for ${scopeLabel}` : 'The latest candidates scored by AI'}
          flush
          className="reveal"
          action={
            <Link to={selected ? `/hr/recruiteone/cv-pool?vacancy=${selected.id}` : '/hr/recruiteone/cv-pool'} className="text-link">
              Open CV pool
            </Link>
          }
        >
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th scope="col">Candidate</th>
                  <th scope="col">Vacancy</th>
                  <th scope="col">Score</th>
                  <th scope="col">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {recentEvaluations.length === 0 && (
                  <tr>
                    <td colSpan={4} className="cell-secondary">{selected ? 'No CVs have been scored for this vacancy yet.' : 'No CVs have been scored yet.'}</td>
                  </tr>
                )}
                {recentEvaluations.map((evaluation) => (
                  <tr key={evaluation.id}>
                    <td>
                      <div className="cell-person">
                        <Avatar name={evaluation.full_name} />
                        <div>
                          <p className="cell-primary">{evaluation.full_name}</p>
                          <p className="cell-secondary">{formatDate(evaluation.created_at)}</p>
                        </div>
                      </div>
                    </td>
                    <td>{vacancyTitle(evaluation.vacancy_ids[0])}</td>
                    <td>
                      <ScoreRing value={evaluation.score?.overall_score ?? 0} size={34} />
                    </td>
                    <td>
                      <RecommendationBadge recommendation={evaluation.score?.recommendation ?? 'not_a_match'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card icon={<Activity />} title="Recent activity" description={selected ? `What happened for ${scopeLabel}` : 'What happened in your workspace'} className="reveal">
          {recentActivity.length === 0 && <p className="wizard__muted">{selected ? 'Nothing has happened for this vacancy yet.' : 'Nothing has happened yet. Create a JD to get started.'}</p>}
          <ul className="timeline">
            {recentActivity.map((item) => (
              <li key={item.id}>
                <p className="cell-primary">{item.message}</p>
                <p className="cell-secondary">
                  {item.detail} · {formatDate(item.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
