import { ArrowLeft, Info, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate, formatDateRange } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { ApprovalLink } from '../components/approval/ApprovalLink'
import { ResultsTab } from '../components/interview/ResultsTab'
import { ScoreCandidates } from '../components/interview/ScoreCandidates'
import { ScorecardTab } from '../components/interview/ScorecardTab'
import { StageOverview } from '../components/interview/StageOverview'
import { VacancyBrief } from '../components/interview/VacancyBrief'
import { collectionState } from '../data/stage'
import { currentStageIndex, pooledCandidates, stageCompleted } from '../services/interviewMath'
import { useCurrentUser } from '../state/CurrentUser'
import { useStore } from '../state/RecruiteOneStore'
import type { Candidate } from '../types'
import { canOpenInterview } from './InterviewsPage'

type View = 'brief' | 'overview' | 'scorecard' | 'score' | 'results'

const viewLabels: Record<View, string> = {
  brief: 'Job & CVs',
  overview: 'Overview',
  scorecard: 'Create scorecard',
  score: 'Score candidates',
  results: 'Results',
}

export function InterviewPage() {
  usePageTitle('Interview')
  const { interviewId } = useParams()
  const { interviews, vacancies, candidates, jds } = useStore()
  const { user, isHr } = useCurrentUser()
  const interview = interviews.find((item) => item.id === interviewId)
  const vacancy = vacancies.find((item) => item.id === interview?.vacancy_id)
  const collectionClosed = vacancy ? vacancy.collection_closed_at !== null : false
  const [stageId, setStageId] = useState<string | null>(null)
  const [view, setView] = useState<View>(collectionClosed ? (isHr ? 'overview' : 'score') : 'brief')
  const stages = vacancy?.pipeline?.stages ?? []

  if (!interview || !vacancy) {
    return <EmptyState icon={<ShieldAlert />} title="Interview not found" description="It may have been removed, or the link is wrong." action={<Link to="/hr/recruiteone/interviews" className="text-link">Back to interviews</Link>} />
  }
  if (!canOpenInterview(vacancy, user.id, isHr)) {
    return (
      <EmptyState
        icon={<ShieldAlert />}
        title="You do not have access to this interview"
        description="Only HR and the interviewers assigned to one of its stages can open it."
        action={<Link to="/hr/recruiteone/interviews" className="text-link">Back to interviews</Link>}
      />
    )
  }

  const visibleStages = isHr ? stages : stages.filter((stage) => stage.interviewer_ids.includes(user.id))
  const currentIndex = currentStageIndex(interview, stages.length)
  const currentStage = stages[currentIndex]
  const defaultStage = visibleStages.find((stage) => stage.id === currentStage?.id) ?? visibleStages[0]
  const stage = visibleStages.find((item) => item.id === stageId) ?? defaultStage
  if (!stage) {
    return <EmptyState icon={<ShieldAlert />} title="No stages" description="This interview has no pipeline stages." />
  }
  const stageIndex = stages.findIndex((item) => item.id === stage.id)
  const jd = jds.find((item) => item.id === vacancy.jd_id)

  const views: View[] = isHr ? ['brief', 'overview', 'scorecard', 'score', 'results'] : ['brief', 'scorecard', 'score']
  const activeView: View = views.includes(view) ? view : views[0]

  const allCandidates = interview.candidate_ids
    .map((id) => candidates.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is Candidate => candidate !== undefined)
  const reachedCandidates = allCandidates.filter((candidate) => (interview.progress[candidate.id]?.stage_index ?? 0) >= stageIndex)
  const firstVisibleIndex = Math.min(...visibleStages.map((item) => stages.findIndex((entry) => entry.id === item.id)))
  const briefCandidates = collectionClosed
    ? allCandidates.filter((candidate) => isHr || (interview.progress[candidate.id]?.stage_index ?? 0) >= firstVisibleIndex)
    : pooledCandidates(vacancy.id, candidates)

  const closingText = collectionClosed
    ? `CV collection closed ${formatDate(vacancy.collection_closed_at)}`
    : vacancy.closing_date
      ? `CV collection ${collectionState(vacancy) === 'ended' ? 'ended' : 'closes'} ${formatDate(vacancy.closing_date)}`
      : 'CV collection is open'
  const description = [
    closingText,
    `Interviews ${formatDateRange(stages.map((item) => item.scheduled_date))}`,
    collectionClosed ? `${interview.candidate_ids.length} candidates` : null,
    isHr ? null : 'you only see your own scorecards and scores',
  ]
    .filter((part): part is string => part !== null)
    .join(' · ')

  return (
    <>
      <Link to="/hr/recruiteone/interviews" className="back-link">
        <ArrowLeft aria-hidden="true" />
        All interviews
      </Link>
      <PageHeader title={vacancy.title} description={description} actions={<ApprovalLink approvalId={vacancy.approval_id} />} />

      {!collectionClosed && (
        <div className="notice">
          <Info aria-hidden="true" />
          <span>
            {collectionState(vacancy) === 'ended'
              ? 'The closing date has passed and applications have stopped, but HR has not closed the CV collection yet. '
              : 'The CV collection is still open. '}
            Read the job description and the scored CVs under Job &amp; CVs and prepare your scorecard now. Candidates enter the interview when HR sends them to the pipeline or closes the collection in the CV Pool.
          </span>
        </div>
      )}

      <div className="stage-bar">
        <div className="stage-tabs" role="tablist" aria-label="Interview stages">
          {visibleStages.map((item) => {
            const index = stages.findIndex((entry) => entry.id === item.id)
            const mine = item.interviewer_ids.includes(user.id)
            const isCurrent = collectionClosed && index === currentIndex
            const done = stageCompleted(interview, index)
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === stage.id}
                aria-current={isCurrent ? 'step' : undefined}
                className={`stage-tab${isCurrent ? ' stage-tab--current' : ''}${done ? ' stage-tab--done' : ''}`}
                onClick={() => setStageId(item.id)}
              >
                <span className="stage-tab__name">
                  {index + 1}. {item.name}
                  {isCurrent && <span className="stage-tab__tag">Current</span>}
                  {done && !isCurrent && <span className="stage-tab__tag stage-tab__tag--done">Done</span>}
                </span>
                <span className="stage-tab__meta">
                  {item.scheduled_date ? formatDate(item.scheduled_date) : 'No date'}
                  {mine ? ' · you' : ''}
                </span>
              </button>
            )
          })}
        </div>
        <nav className="segmented interview-nav" aria-label="Interview sections">
          {views.map((item) => (
            <button key={item} type="button" aria-pressed={activeView === item} onClick={() => setView(item)}>
              {viewLabels[item]}
            </button>
          ))}
        </nav>
      </div>

      <Card flush className="reveal card--fill interview-card">
        {activeView === 'brief' && <VacancyBrief vacancy={vacancy} jd={jd} candidates={briefCandidates} collectionClosed={collectionClosed} />}
        {activeView === 'overview' && <StageOverview interview={interview} stage={stage} stageIndex={stageIndex} stages={stages} candidates={allCandidates} openings={vacancy.openings} />}
        {activeView === 'scorecard' && <ScorecardTab interview={interview} stage={stage} />}
        {activeView === 'score' && (
          <ScoreCandidates
            interview={interview}
            stage={stage}
            stageIndex={stageIndex}
            candidates={reachedCandidates}
            collectionClosed={collectionClosed}
            onCreateScorecard={() => setView('scorecard')}
          />
        )}
        {activeView === 'results' && (
          <ResultsTab interview={interview} stage={stage} stageIndex={stageIndex} stages={stages} candidates={reachedCandidates} openings={vacancy.openings} />
        )}
      </Card>
    </>
  )
}
