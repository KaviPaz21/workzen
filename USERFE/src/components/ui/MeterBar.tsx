interface MeterBarProps {
  label: string
  value: number
  max?: number
  display?: string
  tone?: 'accent' | 'coral' | 'amber' | 'ink' | 'green'
}

export function MeterBar({ label, value, max = 100, display, tone = 'accent' }: MeterBarProps) {
  const percent = max === 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div className="meter">
      <span className="meter__label">{label}</span>
      <span className="meter__value">{display ?? value}</span>
      <div
        className="meter__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div className={`meter__fill${tone === 'accent' ? '' : ` meter__fill--${tone}`}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
