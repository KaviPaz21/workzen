import { ArrowUp, ImagePlus, Paperclip } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { AssistantOptions, ChatMode, Effort } from '../types'

interface ComposerProps {
  options: AssistantOptions | null
  mode: ChatMode
  model: string | null
  effort: Effort
  disabled: boolean
  centered: boolean
  coworker: boolean
  onModel: (model: string) => void
  onEffort: (effort: Effort) => void
  onSend: (text: string) => void
}

const effortLabels: Record<Effort, string> = { low: 'Low effort', medium: 'Medium effort', high: 'High effort' }
const maxHeight = 220
const singleLineHeight = 40

export function Composer({ options, mode, model, effort, disabled, centered, coworker, onModel, onEffort, onSend }: ComposerProps) {
  const [text, setText] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [multiline, setMultiline] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    area.style.height = 'auto'
    area.style.height = `${Math.min(area.scrollHeight, maxHeight)}px`
    setMultiline(area.scrollHeight > singleLineHeight)
  }, [text])

  useEffect(() => {
    if (!hint) return
    const timer = window.setTimeout(() => setHint(null), 2600)
    return () => window.clearTimeout(timer)
  }, [hint])

  function submit(event?: FormEvent) {
    event?.preventDefault()
    if (disabled || text.trim() === '') return
    onSend(text)
    setText('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  const models = options?.models ?? []
  const canSend = !disabled && text.trim() !== '' && model !== null

  return (
    <form className={`composer${centered ? ' composer--centered' : ''}${multiline ? ' composer--multiline' : ''}`} onSubmit={submit}>
      <div className="composer__tools">
        <button type="button" className="composer__icon" aria-label="Attach a file" title="Attach a file" onClick={() => setHint('File upload is coming soon')}>
          <Paperclip aria-hidden="true" />
        </button>
        <button type="button" className="composer__icon" aria-label="Add an image" title="Add an image" onClick={() => setHint('Image upload is coming soon')}>
          <ImagePlus aria-hidden="true" />
        </button>
      </div>
      <label className="sr-only" htmlFor="assistant-input">
        Message
      </label>
      <textarea
        id="assistant-input"
        ref={areaRef}
        className="composer__input"
        rows={1}
        value={text}
        placeholder={coworker ? 'Give Co-worker a task' : mode === 'kb' ? 'Ask about your company documents' : 'Ask WorkZen'}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        autoFocus
      />
      <div className="composer__controls">
        <label className="composer__select">
          <span>Model</span>
          <select value={model ?? ''} aria-label="Model" title="Model" onChange={(event) => onModel(event.target.value)} disabled={models.length === 0}>
            {models.length === 0 && <option value="">No model</option>}
            {models.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="composer__select">
          <span>Effort</span>
          <select value={effort} aria-label="Reasoning effort" title="Reasoning effort" onChange={(event) => onEffort(event.target.value as Effort)}>
            {(options?.efforts ?? ['low', 'medium', 'high']).map((level) => (
              <option key={level} value={level}>
                {effortLabels[level]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="composer__send" aria-label="Send message" disabled={!canSend}>
          <ArrowUp aria-hidden="true" />
        </button>
      </div>
      {hint && (
        <span className="composer__hint" role="status">
          {hint}
        </span>
      )}
    </form>
  )
}
