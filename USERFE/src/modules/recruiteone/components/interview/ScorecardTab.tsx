import { personById } from '../../data/people'
import { commonCard, personalCard } from '../../services/interviewMath'
import { useCurrentUser } from '../../state/CurrentUser'
import { useStore } from '../../state/RecruiteOneStore'
import type { Interview, PipelineStage } from '../../types'
import { CriteriaList, ScorecardBuilder } from './shared'

interface ScorecardTabProps {
  interview: Interview
  stage: PipelineStage
}

export function ScorecardTab({ interview, stage }: ScorecardTabProps) {
  const { user, isHr } = useCurrentUser()
  const { scorecards, saveScorecard } = useStore()
  const assigned = stage.interviewer_ids.includes(user.id)
  const common = commonCard(scorecards, interview.id, stage.id)
  const mine = personalCard(scorecards, interview.id, stage.id, user.id)

  return (
    <div className="scorecard-tab">
      <div className="scorecard-tab__intro">
        <h3>Scorecards for {stage.name}</h3>
        <p className="wizard__muted">
          A scorecard lists what is assessed in this stage and the highest score for each item.
          {isHr && ' HR can set a common scorecard that every interviewer of this stage can use.'}
          {assigned && ' You can also define your own scorecard. It is private to you and HR.'}
        </p>
      </div>

      <div className="scorecard-tab__grid">
        {isHr ? (
          <section className="scorecard-box">
            <header>
              <h4>Common scorecard</h4>
              <p className="cell-secondary">
                {common ? `Last saved by ${personById(common.created_by)?.name ?? 'HR'}.` : 'Not defined yet.'} Interviewers without their own scorecard use this one.
              </p>
            </header>
            <ScorecardBuilder
              key={`common-${common?.id ?? 'new'}`}
              initial={common?.criteria ?? []}
              saveLabel={common ? 'Save common scorecard' : 'Create common scorecard'}
              onSave={(criteria) => saveScorecard(interview.id, stage.id, null, user.id, criteria)}
            />
          </section>
        ) : (
          common && (
            <section className="scorecard-box">
              <header>
                <h4>Common scorecard</h4>
                <p className="cell-secondary">Set by {personById(common.created_by)?.name ?? 'HR'}. You use it unless you define your own.</p>
              </header>
              <CriteriaList card={common} />
            </section>
          )
        )}

        {assigned ? (
          <section className="scorecard-box">
            <header>
              <h4>My scorecard</h4>
              <p className="cell-secondary">{mine ? 'Edit your own scorecard.' : 'Define your own scorecard for this stage.'}</p>
            </header>
            <ScorecardBuilder
              key={`mine-${mine?.id ?? 'new'}`}
              initial={mine?.criteria ?? []}
              saveLabel={mine ? 'Save my scorecard' : 'Create my scorecard'}
              onSave={(criteria) => saveScorecard(interview.id, stage.id, user.id, user.id, criteria)}
            />
          </section>
        ) : (
          isHr && (
            <section className="scorecard-box scorecard-box--note">
              <p className="wizard__muted">You are not an interviewer in this stage, so you can only define the common scorecard.</p>
            </section>
          )
        )}
      </div>
    </div>
  )
}
