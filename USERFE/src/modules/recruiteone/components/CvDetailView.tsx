import { ArrowLeft, Eye, RefreshCw, TriangleAlert } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { formatDate } from '@/lib/format'
import type { Batch, Candidate } from '../types'
import { RecommendationBadge } from './StatusBadges'

interface CvDetailViewProps {
  candidate: Candidate
  batch?: Batch
  onBack?: () => void
  onViewCv: (candidate: Candidate) => void
  onRetry: (candidate: Candidate) => void
}

export function CvDetailView({ candidate, batch, onBack, onViewCv, onRetry }: CvDetailViewProps) {
  const score = candidate.score

  return (
    <div className="cv-detail">
      {onBack && batch && (
        <button type="button" className="back-link back-link--button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          {batch.name}
        </button>
      )}

      <header className="cv-detail__head">
        <Avatar name={candidate.full_name} />
        <div className="cv-detail__who">
          <h3>{candidate.full_name}</h3>
          <p className="cell-secondary">
            {[candidate.current_title, candidate.email, candidate.phone].filter(Boolean).join(' · ') || candidate.file_name}
          </p>
          <p className="cell-secondary">
            {candidate.source === 'application' ? 'Application link' : 'Uploaded'} · {formatDate(candidate.created_at)} · {candidate.file_name}
          </p>
        </div>
        <Button variant="secondary" icon={<Eye />} onClick={() => onViewCv(candidate)}>
          View CV
        </Button>
      </header>

      {score ? (
        <>
          <section className="cv-detail__overall" aria-label="Overall result">
            <ScoreRing value={score.overall_score} size={64} />
            <div className="cv-detail__overall-text">
              <div className="cv-detail__overall-line">
                <span className="cell-primary">Overall score {score.overall_score} out of 100</span>
                <RecommendationBadge recommendation={score.recommendation} />
              </div>
              <p>{score.summary}</p>
              <p className="cell-secondary">
                The overall score is the average of the benchmark scores below, weighted by the percentages set on the job description.
                Benchmarks the job description does not list are left out.
              </p>
            </div>
          </section>

          <ol className="benchmarks">
            {score.benchmarks.map((benchmark) => (
              <li key={benchmark.key} className={`benchmark${benchmark.applicable ? '' : ' benchmark--muted'}`}>
                <div className="benchmark__head">
                  <h4 className="benchmark__title">{benchmark.label}</h4>
                  <span className="chip">Weight {benchmark.weight}%</span>
                  <span className="benchmark__score">{benchmark.applicable ? `${benchmark.score}/100` : 'Not scored'}</span>
                </div>
                {benchmark.applicable && (
                  <div className="meter__track" role="progressbar" aria-label={`${benchmark.label} score`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={benchmark.score}>
                    <div className="meter__fill" style={{ width: `${benchmark.score}%` }} />
                  </div>
                )}
                <p className="benchmark__reasoning">{benchmark.reasoning}</p>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="cv-detail__pending">
          {candidate.score_status === 'failed' ? (
            <>
              <TriangleAlert aria-hidden="true" />
              <p className="cell-primary">This CV could not be scored.</p>
              <p className="wizard__muted">{candidate.score_error}</p>
            </>
          ) : (
            <p className="cell-primary">{candidate.score_status === 'scoring' ? 'AI is scoring this CV…' : 'This CV is waiting to be scored.'}</p>
          )}
          {candidate.score_status !== 'scoring' && (
            <Button icon={<RefreshCw />} onClick={() => onRetry(candidate)}>
              Score now
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
