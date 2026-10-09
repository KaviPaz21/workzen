import { levelOptions } from '../data/buckets'
import type { Level } from '../types'

interface JdMetaFieldsProps {
  role: string
  sector: string
  level: Level
  onChange: (changes: { role?: string; sector?: string; level?: Level }) => void
}

export function JdMetaFields({ role, sector, level, onChange }: JdMetaFieldsProps) {
  return (
    <div className="meta-fields">
      <label className="field">
        <span className="field__label">Role</span>
        <input className="input" value={role} onChange={(event) => onChange({ role: event.target.value })} />
      </label>
      <label className="field">
        <span className="field__label">Sector</span>
        <input className="input" value={sector} onChange={(event) => onChange({ sector: event.target.value })} />
      </label>
      <label className="field">
        <span className="field__label">Level</span>
        <select className="select select--full" value={level} onChange={(event) => onChange({ level: event.target.value as Level })}>
          {levelOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
