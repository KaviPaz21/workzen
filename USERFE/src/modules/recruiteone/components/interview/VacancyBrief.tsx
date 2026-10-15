import { Eye } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { formatDate, relativeDay, titleCase } from '@/lib/format'
import { bucketDefinitions } from '../../data/buckets'
import { collectionState } from '../../data/stage'
import { useCurrentUser } from '../../state/CurrentUser'
import type { Candidate, JobDescription, Vacancy } from '../../types'
import { CvViewerModal } from '../CvViewerModal'
import { RecommendationBadge } from '../StatusBadges'

interface VacancyBriefProps {
  vacancy: Vacancy
  jd: JobDescription | undefined
  candidates: Candidate[]
  collectionClosed: boolean
}

export function VacancyBrief({ vacancy, jd, candidates, collectionClosed }: VacancyBriefProps) {
  const { user } = useCurrentUser()
  const [viewing, setViewing] = useState<Candidate | null>(null)
  const stages = vacancy.pipeline?.stages ?? []
  const scored = candidates
    .filter((candidate) => candidate.score !== null)
    .sort((a, b) => (b.score?.overall_score ?? 0) - (a.score?.overall_score ?? 0))
  const waiting = candidates.length - scored.length

  return (
    <div className="brief">
      <section className="brief__section">
        <h3 className="brief__title">Key dates</h3>
        <dl className="detail-list detail-list--grid">
          <div>
            <dt>CV collection closing date</dt>
            <dd>{vacancy.closing_date ? formatDate(vacancy.closing_date) : 'No closing date set'}</dd>
            <span className="cell-secondary">
              {collectionClosed ? `Collection closed ${formatDate(vacancy.collection_closed_at)}` : vacancy.closing_date
                  ? collectionState(vacancy) === 'ended'
                    ? `Ended ${relativeDay(vacancy.closing_date)}, applications have stopped`
                    : `Closes ${relativeDay(vacancy.closing_date)}`
                  : 'Collection is open'}
            </span>
          </div>
          {stages.map((stage, index) => (
            <div key={stage.id}>
              <dt>
                Stage {index + 1}: {stage.name}
              </dt>
              <dd>{stage.scheduled_date ? formatDate(stage.scheduled_date) : 'Date not set'}</dd>
              <span className="cell-secondary">
                {stage.interviewer_ids.includes(user.id)
                  ? 'You are an interviewer'
                  : `${stage.interviewer_ids.length} ${stage.interviewer_ids.length === 1 ? 'interviewer' : 'interviewers'}`}{' '}
                · up to {stage.max_candidates} candidates
              </span>
            </div>
          ))}
        </dl>
      </section>

      <section className="brief__section">
        <h3 className="brief__title">Job description</h3>
        {jd ? (
          <>
            <p className="cell-secondary">
              {jd.name} · {jd.role} · {jd.sector} · {titleCase(jd.level)} level
            </p>
            <div className="bucket-grid">
              {bucketDefinitions.map(({ key, label }) => (
                <section key={key} className="bucket">
                  <h4 className="bucket__title">{label}</h4>
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
            {jd.raw_text && (
              <details className="original-text">
                <summary>Original JD text</summary>
                <pre>{jd.raw_text}</pre>
              </details>
            )}
          </>
        ) : (
          <p className="wizard__muted">The job description for this vacancy is no longer available.</p>
        )}
      </section>

      <section className="brief__section">
        <h3 className="brief__title">{collectionClosed ? 'Candidates in the interview' : 'CVs scored so far'}</h3>
        <p className="wizard__muted">
          {collectionClosed
            ? 'Candidates who have reached your stages. Open a CV to read it before the interview.'
            : 'CVs appear here as soon as they are scored, so you can read them and prepare your scorecard. Candidates enter the interview when HR sends them to the pipeline or closes the collection.'}
        </p>
        {scored.length === 0 ? (
          <p className="brief__empty">{candidates.length === 0 ? 'No CVs have been added yet.' : `${waiting} ${waiting === 1 ? 'CV is' : 'CVs are'} still being scored.`}</p>
        ) : (
          <div className="table-wrap table-wrap--plain">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th scope="col">Candidate</th>
                  <th scope="col">AI match</th>
                  <th scope="col">
                    <span className="sr-only">CV</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {scored.map((candidate) => (
                  <tr key={candidate.id}>
                    <td className="cell-wide">
                      <div className="cell-person">
                        <Avatar name={candidate.full_name} small />
                        <div>
                          <span className="cell-primary">{candidate.full_name}</span>
                          <p className="cell-secondary">{candidate.current_title || candidate.file_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="nowrap">
                      {candidate.score && (
                        <>
                          <strong>{candidate.score.overall_score}%</strong> <RecommendationBadge recommendation={candidate.score.recommendation} />
                        </>
                      )}
                    </td>
                    <td className="align-right">
                      <Button size="sm" variant="secondary" icon={<Eye />} aria-label={`View CV of ${candidate.full_name}`} onClick={() => setViewing(candidate)}>
                        View CV
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {scored.length > 0 && waiting > 0 && <p className="field__hint">{waiting} more {waiting === 1 ? 'CV is' : 'CVs are'} still being scored.</p>}
      </section>

      {viewing && <CvViewerModal candidate={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
