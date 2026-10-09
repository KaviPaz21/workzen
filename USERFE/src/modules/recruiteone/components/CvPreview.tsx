import { FileQuestion } from 'lucide-react'
import { useCvFile } from '@/lib/useCvFile'
import type { Candidate } from '../types'

export function CvPreview({ candidate }: { candidate: Candidate }) {
  const view = useCvFile(candidate)

  if (view.kind === 'loading') return <p className="wizard__muted">Loading the CV…</p>
  if (view.kind === 'pdf') return <iframe className="cv-frame cv-frame--fill" title={`CV of ${candidate.full_name}`} src={view.url} />
  if (view.kind === 'text') return <pre className="cv-text cv-text--fill">{view.text}</pre>
  if (view.kind === 'other') {
    return (
      <div className="cv-missing">
        <FileQuestion aria-hidden="true" />
        <p className="cell-primary">This file type cannot be previewed in the browser.</p>
        <a className="btn btn--secondary btn--md" href={view.url} download={candidate.file_name}>
          Download {candidate.file_name}
        </a>
      </div>
    )
  }
  return (
    <div className="cv-missing">
      <FileQuestion aria-hidden="true" />
      <p className="cell-primary">The original file is not stored for this candidate.</p>
      <p className="wizard__muted">This is a sample record, so only its profile is available.</p>
      <dl className="detail-list">
        <div>
          <dt>Current title</dt>
          <dd>{candidate.current_title || '—'}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{candidate.email || '—'}</dd>
        </div>
        <div>
          <dt>Skills</dt>
          <dd>{candidate.skills.length > 0 ? candidate.skills.join(', ') : '—'}</dd>
        </div>
      </dl>
    </div>
  )
}
