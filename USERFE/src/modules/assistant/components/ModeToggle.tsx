import { BookOpen, Sparkles } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { ChatMode, ModeStatus } from '../types'

interface ModeToggleProps {
  value: ChatMode
  modes: ModeStatus[]
  onChange: (mode: ChatMode) => void
  disabled?: boolean
}

const fallback: ModeStatus[] = [
  { id: 'gpt', label: 'GPT', ready: true, detail: 'General knowledge' },
  { id: 'kb', label: 'Internal KB', ready: true, detail: 'Company documents' },
]

const icons = { gpt: Sparkles, kb: BookOpen }

export function ModeToggle({ value, modes, onChange, disabled = false }: ModeToggleProps) {
  const shown = modes.length > 0 ? modes : fallback
  const index = Math.max(
    0,
    shown.findIndex((mode) => mode.id === value),
  )
  return (
    <div className={`mode-toggle${disabled ? ' mode-toggle--off' : ''}`} role="group" aria-label="Answer source" data-count={shown.length} style={{ '--count': shown.length, '--index': index } as CSSProperties}>
      {shown.map((mode) => {
        const Icon = icons[mode.id]
        return (
          <button key={mode.id} type="button" aria-pressed={mode.id === value} title={disabled ? 'Turn off Co-worker to change the answer source' : mode.detail} disabled={disabled} onClick={() => onChange(mode.id)}>
            <Icon aria-hidden="true" />
            {mode.label}
          </button>
        )
      })}
    </div>
  )
}
