import { Download, FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { JobDescription, Vacancy } from '../types'
import { downloadExcel, sortByScore, type ExportRow } from '../services/exportExcel'

interface ExportExcelModalProps {
  vacancy: Vacancy
  jd: JobDescription | undefined
  rows: ExportRow[]
  scopeLabel: string
  onClose: () => void
}

export function ExportExcelModal({ vacancy, jd, rows, scopeLabel, onClose }: ExportExcelModalProps) {
  const total = rows.length
  const [count, setCount] = useState(Math.min(10, total))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const presets = [5, 10, 25].filter((value) => value < total)
  const preview = sortByScore(rows).slice(0, Math.min(count, 5))

  async function exportNow() {
    setBusy(true)
    setError(null)
    try {
      await downloadExcel({ vacancy, jd, rows, scopeLabel, count })
      onClose()
    } catch {
      setError('The Excel file could not be created. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Export to Excel"
      description={scopeLabel}
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={<Download />} disabled={busy || total === 0 || count < 1} onClick={exportNow}>
            {busy ? 'Preparing…' : 'Download'}
          </Button>
        </>
      }
    >
      {total === 0 ? (
        <p className="wizard__muted">There are no scored CVs to export yet.</p>
      ) : (
        <div className="form-stack">
          <p className="wizard__muted">
            The file lists each candidate's name, details, overall score, a score and reasoning for every benchmark, and the AI summary. {total} scored{' '}
            {total === 1 ? 'CV is' : 'CVs are'} available.
          </p>
          <div className="field">
            <label className="field__label" htmlFor="export-count">
              Number of top candidates
            </label>
            <div className="export-count">
              <input
                id="export-count"
                className="input"
                type="number"
                min={1}
                max={total}
                value={count}
                onChange={(event) => setCount(Math.max(1, Math.min(total, Number(event.target.value) || 1)))}
              />
              <div className="export-count__presets">
                {presets.map((value) => (
                  <Button key={value} size="sm" variant={count === value ? 'primary' : 'secondary'} onClick={() => setCount(value)}>
                    Top {value}
                  </Button>
                ))}
                <Button size="sm" variant={count === total ? 'primary' : 'secondary'} onClick={() => setCount(total)}>
                  All {total}
                </Button>
              </div>
            </div>
          </div>
          <div className="export-preview">
            <p className="mini-heading">
              <FileSpreadsheet aria-hidden="true" /> First rows in the file
            </p>
            <ol>
              {preview.map(({ candidate, score }, index) => (
                <li key={candidate.id}>
                  <span className="export-preview__rank">{index + 1}</span>
                  <span className="export-preview__name">{candidate.full_name}</span>
                  <span className="export-preview__score">{score.overall_score}</span>
                </li>
              ))}
            </ol>
          </div>
          {error && (
            <div className="notice notice--danger" role="alert">
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
