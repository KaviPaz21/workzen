import { Check, FileText, Inbox, TriangleAlert, Upload, X } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatDate } from '@/lib/format'
import { useStore, type SkippedFile } from '../state/RecruiteOneStore'
import type { Batch } from '../types'

const allowed = ['.pdf', '.docx', '.txt']
const maxBytes = 10 * 1024 * 1024

interface UploadCvsModalProps {
  initialVacancyId: string | null
  onClose: () => void
  onViewBatch?: (vacancyId: string, batchId: string) => void
}

function validate(file: File) {
  const lower = file.name.toLowerCase()
  if (!allowed.some((extension) => lower.endsWith(extension))) return `${file.name}: only PDF, DOCX or TXT files are accepted.`
  if (file.size > maxBytes) return `${file.name}: the file is larger than 10 MB.`
  return null
}

export function UploadCvsModal({ initialVacancyId, onClose, onViewBatch }: UploadCvsModalProps) {
  const { vacancies, batches, candidates, createBatch } = useStore()
  const [vacancyId, setVacancyId] = useState(initialVacancyId ?? '')
  const [batchName, setBatchName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [fetchIds, setFetchIds] = useState<string[]>([])
  const [problems, setProblems] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ batch: Batch; count: number; skipped: SkippedFile[] } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const targets = vacancies.filter((vacancy) => vacancy.status !== 'closed' && vacancy.collection_closed_at === null)
  const vacancy = vacancies.find((item) => item.id === vacancyId)
  const suggestedName = vacancy ? `Batch ${batches.filter((batch) => batch.vacancy_id === vacancy.id).length + 1}` : ''
  const nameValue = nameTouched ? batchName : suggestedName
  const waiting = vacancy
    ? candidates.filter((candidate) => candidate.vacancy_ids.includes(vacancy.id) && candidate.batch_id === null && candidate.source === 'application')
    : []
  const total = files.length + fetchIds.length
  const canCreate = vacancy !== undefined && nameValue.trim().length > 0 && total > 0 && !busy

  function addFiles(list: FileList | null) {
    if (!list) return
    const accepted: File[] = []
    const rejected: string[] = []
    Array.from(list).forEach((file) => {
      const problem = validate(file)
      if (problem) rejected.push(problem)
      else accepted.push(file)
    })
    setFiles((current) => [...current, ...accepted])
    setProblems(rejected)
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    addFiles(event.dataTransfer.files)
  }

  function changeVacancy(id: string) {
    setVacancyId(id)
    setFetchIds([])
  }

  function toggleFetch(id: string) {
    setFetchIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  async function submit() {
    if (!vacancy) return
    setBusy(true)
    setError(null)
    try {
      const result = await createBatch({ vacancyId: vacancy.id, name: nameValue, files, fetchIds })
      setCreated({ batch: result.batch, count: result.uploaded + fetchIds.length, skipped: result.skipped })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The batch could not be created. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Upload CVs"
      description={vacancy ? `Create a batch for ${vacancy.title}` : 'Group CVs into a named batch for a vacancy.'}
      closeOnBackdrop={false}
      footer={
        created ? (
          <>
            {onViewBatch && (
              <Button variant="secondary" onClick={() => onViewBatch(created.batch.vacancy_id, created.batch.id)}>
                View batch
              </Button>
            )}
            <Button onClick={onClose}>Done</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button icon={<Upload />} disabled={!canCreate} onClick={submit}>
              {busy ? 'Creating…' : total > 0 ? `Create batch with ${total} ${total === 1 ? 'CV' : 'CVs'}` : 'Create batch'}
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="wizard__done">
          <span className="wizard__done-icon" aria-hidden="true">
            <Check />
          </span>
          <h3>Batch “{created.batch.name}” created</h3>
          <p className="wizard__muted">
            {created.count} {created.count === 1 ? 'CV is' : 'CVs are'} being scored against the job description. Open the vacancy’s CVs tab to follow the results.
          </p>
          {created.skipped.length > 0 && (
            <div className="notice notice--danger" role="alert">
              <TriangleAlert aria-hidden="true" />
              <span>
                {created.skipped.length} {created.skipped.length === 1 ? 'file was' : 'files were'} not added: {created.skipped.map((item) => `${item.name} (${item.reason})`).join('; ')}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="form-stack">
          <div className="upload-row">
            <label className="field">
              <span className="field__label">Vacancy</span>
              <select className="select select--full" value={vacancyId} onChange={(event) => changeVacancy(event.target.value)}>
                <option value="">Choose a vacancy</option>
                {targets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Batch name</span>
              <input
                className="input"
                value={nameValue}
                placeholder="For example, Career fair, 8 Oct"
                disabled={!vacancy}
                onChange={(event) => {
                  setNameTouched(true)
                  setBatchName(event.target.value)
                }}
              />
            </label>
          </div>

          <section className="upload-section" aria-labelledby="upload-files-title">
            <h3 id="upload-files-title" className="upload-section__title">
              Upload files
            </h3>
            <label
              className={`drop-area${dragging ? ' drop-area--active' : ''}`}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <input
                ref={inputRef}
                type="file"
                className="sr-only"
                multiple
                accept={allowed.join(',')}
                onChange={(event) => {
                  addFiles(event.target.files)
                  event.target.value = ''
                }}
              />
              <Upload aria-hidden="true" />
              <span className="cell-primary">Drop CVs here or choose files</span>
              <span className="cell-secondary">PDF, DOCX or TXT, up to 10 MB each</span>
            </label>
            {problems.length > 0 && (
              <div className="notice notice--danger" role="alert">
                <TriangleAlert aria-hidden="true" />
                <span>{problems.join(' ')}</span>
              </div>
            )}
            {files.length > 0 && (
              <ul className="file-list" aria-label="Files ready to upload">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="file-list__item">
                    <FileText aria-hidden="true" />
                    <span className="file-list__name">{file.name}</span>
                    <button
                      type="button"
                      className="icon-button icon-button--small"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => setFiles((current) => current.filter((_, position) => position !== index))}
                    >
                      <X />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="upload-section" aria-labelledby="fetch-title">
            <div className="upload-section__head">
              <h3 id="fetch-title" className="upload-section__title">
                Fetch from the shared link
              </h3>
              {waiting.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setFetchIds(fetchIds.length === waiting.length ? [] : waiting.map((candidate) => candidate.id))}
                >
                  {fetchIds.length === waiting.length ? 'Clear all' : 'Select all'}
                </Button>
              )}
            </div>
            {!vacancy ? (
              <p className="wizard__muted">Choose a vacancy to see the applications received through its shared link.</p>
            ) : waiting.length === 0 ? (
              <p className="wizard__muted">
                <Inbox aria-hidden="true" className="inline-icon" />
                {vacancy.share_token ? 'No new applications are waiting from the shared link.' : 'This vacancy has no shared link.'}
              </p>
            ) : (
              <ul className="fetch-list">
                {waiting.map((candidate) => (
                  <li key={candidate.id}>
                    <label className="fetch-row">
                      <input type="checkbox" className="checkbox" checked={fetchIds.includes(candidate.id)} onChange={() => toggleFetch(candidate.id)} />
                      <span className="fetch-row__text">
                        <span className="cell-primary">{candidate.full_name}</span>
                        <span className="cell-secondary">
                          {candidate.file_name} · {formatDate(candidate.created_at)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {error && (
            <div className="notice notice--danger" role="alert">
              <TriangleAlert aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
